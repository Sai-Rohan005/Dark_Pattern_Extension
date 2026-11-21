import numpy as np
import torch

from dpd.models.ui_graph import EDGE_RELATION_NAMES, GraphConfig, build_ui_graph


def test_fixture_page_shapes_edges_and_direction(fixture_graph, graph_schema):
    graph = fixture_graph
    assert graph.x.shape == (5, graph_schema.node_feature_dim)
    assert graph.edge_index.shape[0] == 2
    assert graph.edge_index.dtype == torch.long
    assert graph.edge_attr.shape == (graph.edge_index.shape[1], graph_schema.edge_feature_dim)
    assert torch.isfinite(graph.x).all() and torch.isfinite(graph.edge_attr).all()
    assert graph.edge_index.min() >= 0 and graph.edge_index.max() < graph.num_nodes
    pairs = list(map(tuple, graph.edge_index.T.tolist()))
    assert len(pairs) == len(set(pairs))
    assert all(a != b for a, b in pairs)  # GAT layers add their own self-loops.
    relations = {pair: graph.edge_attr[i] for i, pair in enumerate(pairs)}
    assert relations[(0, 2)][EDGE_RELATION_NAMES.index("contains")] == 1
    assert relations[(2, 0)][EDGE_RELATION_NAMES.index("inside")] == 1
    assert relations[(2, 3)][EDGE_RELATION_NAMES.index("same_row")] == 1
    assert relations[(3, 2)][EDGE_RELATION_NAMES.index("same_row")] == 1
    assert relations[(2, 3)][EDGE_RELATION_NAMES.index("reading_order")] == 1
    assert relations[(3, 2)][EDGE_RELATION_NAMES.index("reading_order")] == 0
    assert torch.allclose(graph.x[:, :graph_schema.num_classes].sum(1), torch.ones(5))
    torch.testing.assert_close(graph.x[2, -6:], torch.tensor([.225, 140 / 300, .25, 40 / 300, .25 * 40 / 300, .95]))


def test_empty_invalid_and_single_node_graphs(fixture_page, graph_schema):
    cfg = GraphConfig()
    for detections in ([], [{"class_id": 2, "bbox": [10, 10, 10, 20], "confidence": .9}],
                       [{"class_id": 99, "bbox": [10, 10, 20, 20], "confidence": .9}]):
        graph = build_ui_graph(detections, 400, 300, graph_schema, cfg)
        assert graph.is_empty and graph.num_nodes == 0
        assert graph.edge_index.shape == (2, 0)
        assert graph.edge_attr.shape == (0, graph_schema.edge_feature_dim)
    graph = build_ui_graph([fixture_page["detections"][2]], 400, 300, graph_schema, cfg)
    assert graph.num_nodes == 1 and graph.edge_index.shape == (2, 0)


def test_geometry_clips_boxes_to_screenshot(graph_schema):
    graph = build_ui_graph([{"class_id": 2, "bbox": [-20, -10, 420, 310], "confidence": 1}],
                           400, 300, graph_schema, GraphConfig())
    np.testing.assert_allclose(graph.x[0, -6:].numpy(), [.5, .5, 1, 1, 1, 1])
