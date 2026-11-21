"""Extract frozen deployed features on the audited sample set; never use DP boxes."""
import argparse
import dataclasses
import json
import math
from pathlib import Path

from huggingface_hub import snapshot_download
import numpy as np
from PIL import Image
import torch
from transformers import AutoModel, PreTrainedTokenizerFast, Dinov2Config, Dinov2Model
from ultralytics import YOLO
import yaml

from dpd.data.audit import sha256, write_csv
from dpd.evaluation.ablation import load_splits
from dpd.models.ui_graph import DinoPreprocessor, GATConfig, GATEncoder, GraphConfig, GraphSchema, build_ui_graph
from dpd.reproducibility import environment_versions, seed_everything

REPO = "sai-Rohan/Dark_pattern_Detection_models"
REVISION = "857a8bf57ffa4b8b809daa85a90a536b04a3302c"
FILES = ["config.json", "graph_schema.json", "dino.pt", "gat.pt", "yolo.pt",
         "modernbert/config.json", "modernbert/model.safetensors", "modernbert/tokenizer.json",
         "modernbert/tokenizer_config.json"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default="configs/ablation.yaml")
    parser.add_argument("--snapshot", help="Use a previously downloaded pinned snapshot")
    args = parser.parse_args()
    config = yaml.safe_load(Path(args.config).read_text())
    seed_everything(config["seed"], config["deterministic"])
    torch.set_num_threads(4)
    rows, split_hashes = load_splits(config)
    output = Path(config["evaluation"]["feature_manifest"]).parent
    output.mkdir(parents=True, exist_ok=True)
    if (output / "manifest.csv").exists():
        raise ValueError("Feature manifest exists; choose a fresh cache")
    snapshot = Path(args.snapshot or snapshot_download(REPO, revision=REVISION, allow_patterns=FILES,
                                                      cache_dir="runs/hf-cache"))
    deployed = json.loads((snapshot / "config.json").read_text())
    model_hashes = {name: sha256(snapshot / name) for name in FILES}
    text_path = Path(config["evaluation"]["text_manifest"])
    text_rows = json.loads(text_path.read_text())
    texts = {r["file_name"]: r for r in text_rows}
    for row in rows:
        if texts[row["file_name"]]["image_sha256"] != row["file_sha256"]:
            raise ValueError("OCR/image identity mismatch")
    checkpoint = torch.load(snapshot / "dino.pt", map_location="cpu", weights_only=True)
    raw = checkpoint.get("teacher", checkpoint.get("student", checkpoint))
    state = {}
    for key, value in raw.items():
        key = key.removeprefix("module.")
        if key.startswith("backbone."):
            state[key.removeprefix("backbone.")] = value
    dino_config = Dinov2Config()
    position_count = state["embeddings.position_embeddings"].shape[1] - 1
    grid_size = math.isqrt(position_count)
    if grid_size**2 != position_count:
        raise ValueError("DINO position embeddings do not form a square patch grid")
    # Restore the checkpoint's learned positional grid; inference crops are
    # still the deployed size and DINO interpolates positions internally.
    dino_config.image_size = grid_size * dino_config.patch_size
    dino = Dinov2Model(dino_config)
    dino.load_state_dict(state, strict=True)
    del checkpoint, raw, state
    dino.eval().requires_grad_(False)
    preprocess = DinoPreprocessor(deployed["visual"]["image_size"])
    bert, loading = AutoModel.from_pretrained(snapshot / "modernbert", local_files_only=True,
                                             attn_implementation="eager", reference_compile=False,
                                             output_loading_info=True)
    if any(loading.values()):
        raise ValueError(f"ModernBERT checkpoint mismatch: {loading}")
    bert.eval().requires_grad_(False)
    # Newer exports name TokenizersBackend, which the pinned transformers does
    # not expose. Use the exact serialized tokenizer with its special tokens.
    tokenizer_config = json.loads((snapshot / "modernbert/tokenizer_config.json").read_text())
    tokenizer_config.pop("tokenizer_class", None)
    tokenizer_config["additional_special_tokens"] = tokenizer_config.pop("extra_special_tokens", [])
    tokenizer = PreTrainedTokenizerFast(tokenizer_file=str(snapshot / "modernbert/tokenizer.json"),
                                       **tokenizer_config)
    if len(tokenizer) != bert.config.vocab_size:
        raise ValueError("Tokenizer and text encoder vocabulary sizes disagree")
    # YOLO's serialized architecture is loaded only from the explicit pinned user repository.
    detector = YOLO(str(snapshot / "yolo.pt"), task="detect")
    schema = GraphSchema.load(str(snapshot / "graph_schema.json"))
    if list(detector.names.values()) != schema.class_names:
        raise ValueError("YOLO class vocabulary differs from graph schema")
    graph_cfg = GraphConfig(**schema.graph_config)
    saved = torch.load(snapshot / "gat.pt", map_location="cpu", weights_only=True)
    if saved.get("graph_schema") != dataclasses.asdict(schema):
        raise ValueError("Deployed graph schema differs from GAT training schema")
    valid = {f.name for f in dataclasses.fields(GATConfig)}
    cfg = GATConfig(**{k: v for k, v in saved.get("config", {}).get("gat", {}).items() if k in valid})
    gat = GATEncoder(schema.node_feature_dim, schema.edge_feature_dim, cfg)
    gat.load_state_dict(saved.get("model_state_dict", saved), strict=True)
    gat.eval().requires_grad_(False)
    del saved
    records, empty_graphs = [], 0
    for i, row in enumerate(rows):
        with Image.open(row["image_path"]) as raw_image:
            image = raw_image.convert("RGB")
        with torch.inference_mode():
            visual = dino(pixel_values=preprocess(image).unsqueeze(0)).pooler_output.squeeze(0).numpy()
            detected = detector.predict(image, conf=0.25, iou=0.45, imgsz=640, max_det=300,
                                        device="cpu", verbose=False)[0].boxes
            detections = [{"bbox": box.tolist(), "confidence": float(conf), "class_id": int(cls)}
                          for box, conf, cls in zip(detected.xyxy.cpu(), detected.conf.cpu(), detected.cls.cpu())]
            graph = build_ui_graph(detections, image.width, image.height, schema, graph_cfg)
            empty_graphs += int(graph.num_nodes == 0)
            graph_feature = gat(graph).squeeze(0).numpy()
            tokens = tokenizer(texts[row["file_name"]]["text"], truncation=True,
                               max_length=deployed["text"]["max_length"], return_tensors="pt")
            hidden = bert(**tokens).last_hidden_state
            mask = tokens["attention_mask"].unsqueeze(-1).float()
            text_feature = ((hidden * mask).sum(1) / mask.sum(1).clamp(min=1)).squeeze(0).numpy()
        path = output / f"{row['sample_id']}.npz"
        np.savez_compressed(path, visual_feature=visual, graph_feature=graph_feature, text_feature=text_feature)
        records.append({"file_name": row["file_name"], "feature_path": str(path.resolve()),
                        "image_sha256": row["file_sha256"], "feature_sha256": sha256(path)})
        print(f"Extracted {i + 1}/{len(rows)}", flush=True)
    write_csv(output / "manifest.csv", records)
    metadata = {"repo": REPO, "revision": REVISION, "model_sha256": model_hashes,
                "encoders": {"visual": "deployed DINOv2", "text": "deployed ModernBERT on raw OCR",
                             "graph": "deployed GAT on YOLO-predicted UI widgets"},
                "split_sha256": split_hashes, "text_sha256": sha256(text_path),
                "empty_graphs": empty_graphs, "empty_graph_policy": "trained GAT empty_embedding",
                "feature_extraction": "Frozen CPU inference, no labels used, no fine tuning",
                "pretraining_overlap": "Unverified; upstream training manifests not supplied",
                "environment": environment_versions(), "threads": torch.get_num_threads(),
                "dino_config": dino_config.to_dict(),
                "source_sha256": {"extract_features.py": sha256(__file__),
                                  "ui_graph.py": sha256(Path(__file__).resolve().parents[1] / "src/dpd/models/ui_graph.py")}}
    (output / "provenance.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Saved {output / 'manifest.csv'}")


if __name__ == "__main__":
    main()
