"""Shared frozen encoder inference; no model downloads at import time."""
import dataclasses
import json
import math
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModel, PreTrainedTokenizerFast, Dinov2Config, Dinov2Model

from dpd.data.audit import sha256
from dpd.models.ui_graph import DinoPreprocessor, GATConfig, GATEncoder, GraphConfig, GraphSchema, build_ui_graph

MODEL_REPO = "sai-Rohan/Dark_pattern_Detection_models"
MODEL_REVISION = "857a8bf57ffa4b8b809daa85a90a536b04a3302c"
MODEL_FILES = ["config.json", "graph_schema.json", "dino.pt", "gat.pt", "yolo.pt",
               "modernbert/config.json", "modernbert/model.safetensors", "modernbert/tokenizer.json",
               "modernbert/tokenizer_config.json"]


@torch.inference_mode()
def encode_visual(model, preprocess, image):
    return model(pixel_values=preprocess(image).unsqueeze(0)).pooler_output[0].float().cpu().numpy()


@torch.inference_mode()
def encode_text(model, tokenizer, text, max_length):
    tokens = tokenizer(text, truncation=True, max_length=max_length, return_tensors="pt")
    hidden = model(**tokens).last_hidden_state
    mask = tokens["attention_mask"].unsqueeze(-1).float()
    return ((hidden * mask).sum(1) / mask.sum(1).clamp(min=1))[0].float().cpu().numpy()


@torch.inference_mode()
def encode_graph(model, graph):
    return model(graph)[0].float().cpu().numpy()


class FrozenEncoders:
    def __init__(self, snapshot):
        from ultralytics import YOLO

        self.snapshot = Path(snapshot)
        self.deployed = json.loads((self.snapshot / "config.json").read_text())
        self.model_hashes = {name: sha256(self.snapshot / name) for name in MODEL_FILES}
        checkpoint = torch.load(self.snapshot / "dino.pt", map_location="cpu", weights_only=True)
        raw = checkpoint.get("teacher", checkpoint.get("student", checkpoint))
        state = {key.removeprefix("module.").removeprefix("backbone."): value for key, value in raw.items()
                 if key.removeprefix("module.").startswith("backbone.")}
        self.dino_config = Dinov2Config()
        count = state["embeddings.position_embeddings"].shape[1] - 1
        side = math.isqrt(count)
        if side**2 != count:
            raise ValueError("DINO position embeddings must form a square patch grid")
        self.dino_config.image_size = side * self.dino_config.patch_size
        self.dino = Dinov2Model(self.dino_config)
        self.dino.load_state_dict(state, strict=True)
        self.dino.eval().requires_grad_(False)
        del checkpoint, raw, state
        self.preprocess = DinoPreprocessor(self.deployed["visual"]["image_size"])
        self.bert, loading = AutoModel.from_pretrained(self.snapshot / "modernbert", local_files_only=True,
                                                      attn_implementation="eager", reference_compile=False,
                                                      output_loading_info=True)
        if any(loading.values()):
            raise ValueError(f"ModernBERT checkpoint mismatch: {loading}")
        self.bert.eval().requires_grad_(False)
        settings = json.loads((self.snapshot / "modernbert/tokenizer_config.json").read_text())
        settings.pop("tokenizer_class", None)
        settings["additional_special_tokens"] = settings.pop("extra_special_tokens", [])
        self.tokenizer = PreTrainedTokenizerFast(tokenizer_file=str(self.snapshot / "modernbert/tokenizer.json"), **settings)
        if len(self.tokenizer) != self.bert.config.vocab_size:
            raise ValueError("Tokenizer and encoder vocabulary sizes disagree")
        # Serialized YOLO architecture comes from the explicit user-provided repository.
        self.detector = YOLO(str(self.snapshot / "yolo.pt"), task="detect")
        self.schema = GraphSchema.load(self.snapshot / "graph_schema.json")
        if list(self.detector.names.values()) != self.schema.class_names:
            raise ValueError("Detector classes differ from graph schema")
        self.graph_cfg = GraphConfig(**self.schema.graph_config)
        saved = torch.load(self.snapshot / "gat.pt", map_location="cpu", weights_only=True)
        if saved.get("graph_schema") != dataclasses.asdict(self.schema):
            raise ValueError("GAT training schema differs from deployed graph schema")
        fields = {field.name for field in dataclasses.fields(GATConfig)}
        cfg = GATConfig(**{k: v for k, v in saved.get("config", {}).get("gat", {}).items() if k in fields})
        self.gat = GATEncoder(self.schema.node_feature_dim, self.schema.edge_feature_dim, cfg)
        self.gat.load_state_dict(saved.get("model_state_dict", saved), strict=True)
        self.gat.eval().requires_grad_(False)

    def encode(self, image, text):
        image = image.convert("RGB")
        visual = encode_visual(self.dino, self.preprocess, image)
        detected = self.detector.predict(image, conf=.25, iou=.45, imgsz=640, max_det=300,
                                         device="cpu", verbose=False)[0].boxes
        detections = [{"bbox": box.tolist(), "confidence": float(conf), "class_id": int(cls)}
                      for box, conf, cls in zip(detected.xyxy.cpu(), detected.conf.cpu(), detected.cls.cpu())]
        graph = build_ui_graph(detections, image.width, image.height, self.schema, self.graph_cfg)
        max_length = self.deployed["text"]["max_length"]
        features = {"visual": visual, "text": encode_text(self.bert, self.tokenizer, text, max_length),
                    "graph": encode_graph(self.gat, graph)}
        if any(not np.isfinite(value).all() for value in features.values()):
            raise ValueError("Encoder returned nonfinite features")
        count = len(self.tokenizer(text, truncation=False)["input_ids"])
        return features, {"text_tokens_before_truncation": count, "text_truncated": count > max_length,
                          "graph_nodes": int(graph.num_nodes), "graph_edges": int(graph.edge_index.shape[1]),
                          "graph_source": "screenshot_detected_widgets", "empty_graph": graph.num_nodes == 0}
