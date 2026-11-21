"""Validated manifest and frozen-feature loaders shared by experiments."""
import csv
import json
from pathlib import Path
import numpy as np
from dpd.data.audit import overlap, sha256

def load_splits(config):
    rows, hashes = [], {}
    for split in ("train", "val", "test"):
        path = Path(config["data"][f"{split}_manifest"])
        hashes[split] = sha256(path)
        with path.open(newline="") as handle:
            part = list(csv.DictReader(handle))
        if not part:
            raise ValueError(f"Empty {split} manifest")
        for row in part:
            if row.get("split") != split or not row.get("group_id"):
                raise ValueError("Each sample needs its correct split and a reviewed site/app group")
            row["label"] = int(row["label"])
            if row["label"] not in (0, 1):
                raise ValueError("Labels must be binary")
            if sha256(row["image_path"]) != row["file_sha256"]:
                raise ValueError(f"Image changed since audit: {row['file_name']}")
        if {r["label"] for r in part} != {0, 1}:
            raise ValueError(f"Both classes required in {split}")
        rows.extend(sorted(part, key=lambda r: r["file_name"]))
    for key in ("sample_id", "file_name"):
        if len({r[key] for r in rows}) != len(rows):
            raise ValueError(f"Duplicate {key}")
    for key in ("group_id", "file_sha256", "pixel_sha256"):
        if overlap(rows, key):
            raise ValueError(f"Cross-split leakage in {key}")
    return rows, hashes

def load_features(path, rows):
    if not path:
        raise ValueError("feature_manifest is not configured")
    path = Path(path)
    metadata_path = path.with_name("provenance.json")
    metadata = json.loads(metadata_path.read_text())
    if not metadata.get("encoders"):
        raise ValueError("Feature provenance must identify encoders")
    with path.open(newline="") as handle:
        index = list(csv.DictReader(handle))
    by_name = {r["file_name"]: r for r in index}
    if len(by_name) != len(index):
        raise ValueError("Duplicate feature index filenames")
    features = {name: [] for name in ("visual", "text", "graph")}
    for row in rows:
        entry = by_name[row["file_name"]]
        if entry["image_sha256"] != row["file_sha256"] or sha256(entry["feature_path"]) != entry["feature_sha256"]:
            raise ValueError("Feature cache identity/hash mismatch")
        with np.load(entry["feature_path"], allow_pickle=False) as arrays:
            for name in features:
                value = np.asarray(arrays[f"{name}_feature"], dtype=np.float32)
                if value.ndim != 1 or not value.size or not np.isfinite(value).all():
                    raise ValueError(f"Invalid {name} feature for {row['file_name']}")
                features[name].append(value)
    return {name: np.stack(values) for name, values in features.items()}, {
        "manifest_sha256": sha256(path), "provenance_sha256": sha256(metadata_path),
        "provenance": metadata,
    }
