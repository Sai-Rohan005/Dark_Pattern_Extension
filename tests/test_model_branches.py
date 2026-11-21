import numpy as np
from PIL import Image
import pytest
from tokenizers import Tokenizer
from tokenizers.models import WordLevel
from tokenizers.pre_tokenizers import Whitespace
import torch
from transformers import Dinov2Config, Dinov2Model, ModernBertConfig, ModernBertModel, PreTrainedTokenizerFast

from dpd.evaluation.ablation import COMBINATIONS
from dpd.models.encoders import encode_graph, encode_text, encode_visual
from dpd.models.fusion import FeatureFusion
from dpd.models.ui_graph import DinoPreprocessor, GATConfig, GATEncoder, empty_graph


def test_visual_encoder_forward_without_download():
    cfg = Dinov2Config(image_size=32, patch_size=8, hidden_size=24, num_hidden_layers=1,
                      num_attention_heads=3, mlp_ratio=2)
    model = Dinov2Model(cfg).eval()
    image = Image.new("RGB", (80, 40), "white")
    feature = encode_visual(model, DinoPreprocessor(32), image)
    assert feature.shape == (24,) and feature.dtype == np.float32
    assert np.isfinite(feature).all()


def test_text_encoder_forward_without_download():
    backend = Tokenizer(WordLevel({"[UNK]": 0, "[PAD]": 1, "offer": 2, "ends": 3, "soon": 4}, unk_token="[UNK]"))
    backend.pre_tokenizer = Whitespace()
    tokenizer = PreTrainedTokenizerFast(tokenizer_object=backend, unk_token="[UNK]", pad_token="[PAD]",
                                       model_input_names=["input_ids", "attention_mask"])
    cfg = ModernBertConfig(vocab_size=5, hidden_size=16, intermediate_size=32, num_hidden_layers=2,
                          num_attention_heads=2, max_position_embeddings=64, local_attention=8,
                          global_attn_every_n_layers=2, pad_token_id=1, cls_token_id=0, sep_token_id=0,
                          reference_compile=False, attn_implementation="eager")
    model = ModernBertModel(cfg).eval()
    feature = encode_text(model, tokenizer, "offer ends soon", 16)
    assert feature.shape == (16,) and feature.dtype == np.float32
    assert np.isfinite(feature).all()


@pytest.mark.parametrize("empty", [False, True])
def test_graph_encoder_forward(fixture_graph, graph_schema, empty):
    cfg = GATConfig(hidden_dim=16, num_layers=2, heads=2, output_dim=8)
    model = GATEncoder(graph_schema.node_feature_dim, graph_schema.edge_feature_dim, cfg).eval()
    graph = empty_graph(graph_schema) if empty else fixture_graph
    feature = encode_graph(model, graph)
    assert feature.shape == (8,) and np.isfinite(feature).all()
    if empty:
        np.testing.assert_allclose(feature, model.empty_embedding.detach().numpy())


@pytest.mark.parametrize("modalities", COMBINATIONS, ids=lambda names: "+".join(names))
def test_each_projection_branch_and_fusion_forward_backward(modalities):
    dimensions = {"visual": 24, "text": 16, "graph": 8}
    features = {name: torch.randn(2, dimensions[name]) for name in modalities}
    model = FeatureFusion(dimensions, modalities, projection_dim=8, dropout=0)
    logits = model(features)
    assert logits.shape == (2,) and torch.isfinite(logits).all()
    torch.nn.functional.binary_cross_entropy_with_logits(logits, torch.tensor([0., 1.])).backward()
    assert set(model.projections) == set(modalities)
    assert all(parameter.grad is not None and torch.isfinite(parameter.grad).all() for parameter in model.parameters())
