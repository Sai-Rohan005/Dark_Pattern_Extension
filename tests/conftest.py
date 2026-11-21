import dataclasses
import json
from pathlib import Path

import numpy as np
from PIL import Image
import pytest

from dpd.data.audit import sha256, write_csv
from dpd.models.ui_graph import (EDGE_CONTINUOUS_NAMES, EDGE_RELATION_NAMES, NODE_NUMERIC_NAMES,
                                  GraphConfig, GraphSchema, build_ui_graph)


@pytest.fixture
def fixture_page():
    return json.loads((Path(__file__).parent / "fixtures/page.json").read_text())


@pytest.fixture
def graph_schema(fixture_page):
    names = fixture_page["class_names"]
    node_names = ["class_" + name for name in names] + NODE_NUMERIC_NAMES
    return GraphSchema(names, len(names), node_names, len(node_names), EDGE_RELATION_NAMES,
                       EDGE_CONTINUOUS_NAMES, len(EDGE_RELATION_NAMES) + len(EDGE_CONTINUOUS_NAMES),
                       dataclasses.asdict(GraphConfig()))


@pytest.fixture
def fixture_graph(fixture_page, graph_schema):
    return build_ui_graph(fixture_page["detections"], fixture_page["width"], fixture_page["height"],
                          graph_schema, GraphConfig())


@pytest.fixture
def loader_inputs(tmp_path):
    """Independent labeled samples, split manifests and feature cache, all local."""
    config, rows, index = {"data": {}}, [], []
    for split_index, split in enumerate(("train", "val", "test")):
        part = []
        for label in (0, 1):
            identity = f"{split}-{label}"
            path = tmp_path / (identity + ".png")
            Image.new("RGB", (10, 8), (split_index * 70, label * 120, 10)).save(path)
            digest = sha256(path)
            row = dict(sample_id=identity, file_name=path.name, image_path=str(path), label=label,
                       split=split, group_id=f"site:{identity}.example", file_sha256=digest,
                       pixel_sha256=digest)
            part.append(row)
            rows.append(row)
            feature_path = tmp_path / (identity + ".npz")
            offset = split_index * 10 + label
            np.savez(feature_path, visual_feature=np.arange(4, dtype=np.float32) + offset,
                     text_feature=np.arange(6, dtype=np.float32) + offset, graph_feature=np.arange(3, dtype=np.float32) + offset)
            index.append(dict(file_name=path.name, feature_path=str(feature_path), image_sha256=digest,
                              feature_sha256=sha256(feature_path)))
        manifest = tmp_path / (split + ".csv")
        write_csv(manifest, part)
        config["data"][split + "_manifest"] = str(manifest)
    cache = tmp_path / "features.csv"
    write_csv(cache, list(reversed(index)))
    cache.with_name("provenance.json").write_text(json.dumps({"encoders": "synthetic test vectors"}))
    return config, rows, cache
