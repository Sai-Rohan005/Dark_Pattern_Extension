"""Recover a seeded fusion head and verify the original saved predictions."""
import argparse
import csv
import json
from pathlib import Path
import tempfile

import numpy as np
import torch

from dpd.data.audit import sha256
from dpd.data.loaders import load_features, load_splits
from dpd.evaluation.ablation import train_fusion


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", default="results")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", default="checkpoints/fusion-seed42.pt")
    args = parser.parse_args()
    results, target = Path(args.results), Path(args.output)
    if target.exists():
        raise ValueError("Checkpoint already exists; choose a fresh output")
    source = results / "provenance.json"
    record = json.loads(source.read_text())
    config = record["config"]
    if record["status"] != "complete" or args.seed not in config["evaluation"]["seeds"]:
        raise ValueError("Use a seed from a completed scored experiment")
    torch.set_num_threads(config["evaluation"].get("num_threads", 4))
    rows, hashes = load_splits(config)
    if hashes != record["split_sha256"]:
        raise ValueError("Split manifests changed")
    features, provenance = load_features(config["evaluation"]["feature_manifest"], rows)
    if provenance != record["features"]:
        raise ValueError("Feature provenance differs from scored experiment")
    labels = np.array([r["label"] for r in rows])
    masks = {name: np.array([r["split"] == name for r in rows]) for name in ("train", "val", "test")}
    expected_path = results / "predictions" / f"visual+text+graph-{args.seed}.csv"
    if sha256(expected_path) != record["prediction_sha256"][expected_path.name]:
        raise ValueError("Original predictions changed")
    saved = list(csv.DictReader(expected_path.open()))
    if [r["sample_id"] for r in saved] != record["test_order"]:
        raise ValueError("Original test ordering changed")
    with tempfile.TemporaryDirectory() as temp:
        draft = Path(temp) / "head.pt"
        probability, details = train_fusion(features, labels, masks, ("visual", "text", "graph"),
                                            config, args.seed, artifact_path=draft)
        expected = np.array([float(r["probability"]) for r in saved])
        np.testing.assert_allclose(probability, expected, rtol=0, atol=1e-7)
        bundle = torch.load(draft, map_location="cpu", weights_only=True)
    bundle.update(threshold=config["evaluation"]["threshold"], verified_against_saved_predictions=True,
                  encoder_provenance=record["features"]["provenance"], results_sha256=sha256(source),
                  split_sha256=hashes, verification_max_abs_difference=float(np.max(np.abs(probability - expected))),
                  export_source_sha256=sha256(__file__), recovery="Deterministic retraining; no test-based model selection")
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("xb") as handle:
        torch.save(bundle, handle)
    print(json.dumps({"checkpoint": str(target), "sha256": sha256(target), "seed": args.seed,
                      "verification_max_abs_difference": bundle["verification_max_abs_difference"], **details}, indent=2))
