"""Fresh projection/concatenation classifier for frozen-encoder ablations."""
import torch
from torch import nn


class FeatureFusion(nn.Module):
    def __init__(self, dimensions, modalities, projection_dim, dropout):
        super().__init__()
        self.modalities = tuple(modalities)
        self.projections = nn.ModuleDict({
            name: nn.Sequential(nn.Linear(dimensions[name], projection_dim),
                                nn.LayerNorm(projection_dim), nn.GELU(), nn.Dropout(dropout))
            for name in self.modalities
        })
        self.classifier = nn.Linear(projection_dim * len(self.modalities), 1)

    def forward(self, features):
        tokens = [self.projections[name](features[name]) for name in self.modalities]
        return self.classifier(torch.cat(tokens, dim=-1)).squeeze(-1)
