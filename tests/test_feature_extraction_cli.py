"""Exercise extraction orchestration offline; encoder math has separate tests."""
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

import numpy as np
import yaml


def test_extraction_writes_aligned_features_and_provenance(loader_inputs, tmp_path, monkeypatch):
    config, rows, _ = loader_inputs
    target = tmp_path / "new-features/manifest.csv"
    texts = tmp_path / "text.json"
    texts.write_text(json.dumps([dict(file_name=r["file_name"], text="fixture only", image_sha256=r["file_sha256"]) for r in rows]))
    config.update(seed=42, deterministic=True,
                  evaluation={"feature_manifest": str(target), "text_manifest": str(texts)})
    path = tmp_path / "config.yaml"
    path.write_text(yaml.safe_dump(config))
    script = Path(__file__).resolve().parents[1] / "scripts/extract_features.py"
    spec = importlib.util.spec_from_file_location("extract_features_test", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    class FixtureEncoders:
        model_hashes = {}
        dino_config = SimpleNamespace(to_dict=lambda: {})

        def __init__(self, snapshot):
            pass

        def encode(self, image, text):
            assert image.size == (10, 8) and text == "fixture only"
            return {name: np.ones(size, dtype=np.float32) for name, size in (("visual", 4), ("text", 6), ("graph", 3))}, {"empty_graph": False}

    monkeypatch.setattr(module, "FrozenEncoders", FixtureEncoders)
    monkeypatch.setattr(sys, "argv", [str(script), "--config", str(path), "--snapshot", str(tmp_path)])
    module.main()
    from dpd.data.loaders import load_features
    features, metadata = load_features(target, rows)
    assert features["visual"].shape == (len(rows), 4)
    assert metadata["provenance"]["empty_graphs"] == 0
    assert metadata["provenance"]["source_sha256"]["encoders.py"]
