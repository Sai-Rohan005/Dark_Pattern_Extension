import csv
import json
from pathlib import Path

import numpy as np
from PIL import Image
import pytest

from dpd.data.audit import sha256, write_csv
from dpd.data.loaders import load_features, load_splits


def test_manifest_and_feature_alignment(loader_inputs):
    config, _, cache = loader_inputs
    rows, hashes = load_splits(config)
    assert [r["split"] for r in rows] == ["train", "train", "val", "val", "test", "test"]
    assert all(type(r["label"]) is int for r in rows)
    assert set(hashes) == {"train", "val", "test"}
    features, provenance = load_features(cache, rows)
    assert features["visual"].shape == (len(rows), 4)
    assert features["text"].shape == (len(rows), 6)
    assert features["graph"].shape == (len(rows), 3)
    assert all(v.dtype == np.float32 and np.isfinite(v).all() for v in features.values())
    assert provenance["manifest_sha256"] == sha256(cache)
    np.testing.assert_array_equal(features["visual"][:, 0], [0, 1, 10, 11, 20, 21])


@pytest.mark.parametrize("corruption", ["image", "label", "group", "split", "duplicate"])
def test_loader_rejects_invalid_or_leaking_samples(loader_inputs, corruption):
    config, rows, _ = loader_inputs
    path = Path(config["data"]["test_manifest"])
    saved = list(csv.DictReader(path.open()))
    if corruption == "image":
        Image.new("RGB", (10, 8), "red").save(saved[0]["image_path"])
    elif corruption == "label":
        saved[0]["label"] = "2"
    elif corruption == "group":
        saved[0]["group_id"] = rows[0]["group_id"]
    elif corruption == "split":
        saved[0]["split"] = "train"
    else:
        saved.append(dict(saved[0]))
    write_csv(path, saved)
    with pytest.raises(ValueError):
        load_splits(config)


@pytest.mark.parametrize("corruption", ["hash", "nonfinite", "shape", "duplicate", "provenance"])
def test_feature_loader_rejects_bad_cache(loader_inputs, corruption):
    config, _, cache = loader_inputs
    rows, _ = load_splits(config)
    saved = list(csv.DictReader(cache.open()))
    if corruption in {"nonfinite", "shape"}:
        path = Path(saved[0]["feature_path"])
        with np.load(path, allow_pickle=False) as values:
            arrays = {key: values[key] for key in values.files}
        arrays["visual_feature"] = np.array([np.nan], dtype=np.float32) if corruption == "nonfinite" else np.ones((2, 2), dtype=np.float32)
        np.savez(path, **arrays)
        saved[0]["feature_sha256"] = sha256(path)
    elif corruption == "duplicate":
        saved.append(dict(saved[0]))
    elif corruption == "provenance":
        cache.with_name("provenance.json").write_text(json.dumps({}))
    else:
        saved[0]["image_sha256"] = "wrong-image"
    write_csv(cache, saved)
    with pytest.raises(ValueError):
        load_features(cache, rows)
