"""Extract frozen deployed features on the audited sample set; never use DP boxes."""
import argparse
import json
from pathlib import Path

from huggingface_hub import snapshot_download
import numpy as np
from PIL import Image
import torch
import yaml

from dpd.data.audit import sha256, write_csv
from dpd.data.loaders import load_splits
from dpd.models.encoders import FrozenEncoders, MODEL_REPO, MODEL_REVISION, MODEL_FILES
from dpd.reproducibility import environment_versions, seed_everything

REPO, REVISION, FILES = MODEL_REPO, MODEL_REVISION, MODEL_FILES

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
    text_path = Path(config["evaluation"]["text_manifest"])
    text_rows = json.loads(text_path.read_text())
    texts = {row["file_name"]: row for row in text_rows}
    if len(texts) != len(text_rows):
        raise ValueError("Duplicate OCR filenames")
    for row in rows:
        if texts[row["file_name"]]["image_sha256"] != row["file_sha256"]:
            raise ValueError("OCR/image identity mismatch")
    encoders = FrozenEncoders(snapshot)
    records, empty_graphs = [], 0
    for i, row in enumerate(rows):
        with Image.open(row["image_path"]) as raw_image:
            image = raw_image.convert("RGB")
        features, diagnostics = encoders.encode(image, texts[row["file_name"]]["text"])
        empty_graphs += int(diagnostics["empty_graph"])
        path = output / f"{row['sample_id']}.npz"
        np.savez_compressed(path, **{f"{name}_feature": value for name, value in features.items()})
        records.append({"file_name": row["file_name"], "feature_path": str(path.resolve()),
                        "image_sha256": row["file_sha256"], "feature_sha256": sha256(path)})
        print(f"Extracted {i + 1}/{len(rows)}", flush=True)
    write_csv(output / "manifest.csv", records)
    metadata = {"repo": REPO, "revision": REVISION, "model_sha256": encoders.model_hashes,
                "encoders": {"visual": "deployed DINOv2", "text": "deployed ModernBERT on raw OCR",
                             "graph": "deployed GAT on YOLO-predicted UI widgets"},
                "split_sha256": split_hashes, "text_sha256": sha256(text_path),
                "empty_graphs": empty_graphs, "empty_graph_policy": "trained GAT empty_embedding",
                "feature_extraction": "Frozen CPU inference, no labels used, no fine tuning",
                "pretraining_overlap": "Unverified; upstream training manifests not supplied",
                "environment": environment_versions(), "threads": torch.get_num_threads(),
                "dino_config": encoders.dino_config.to_dict(),
                "source_sha256": {"extract_features.py": sha256(__file__),
                                  "encoders.py": sha256(Path(__file__).resolve().parents[1] / "src/dpd/models/encoders.py"),
                                  "ui_graph.py": sha256(Path(__file__).resolve().parents[1] / "src/dpd/models/ui_graph.py")}}
    (output / "provenance.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Saved {output / 'manifest.csv'}")


if __name__ == "__main__":
    main()
