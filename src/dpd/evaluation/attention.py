"""DINO CLS attention rollout; this is not classifier-gradient attribution."""
import numpy as np
import torch


def attention_rollout(attentions):
    joint = None
    for layer in attentions:
        if layer.ndim != 4 or layer.shape[0] != 1 or layer.shape[-1] != layer.shape[-2]:
            raise ValueError("Expected attention [single sample, heads, tokens, tokens]")
        attention = layer[0].mean(0).float()
        augmented = attention + torch.eye(attention.shape[-1], device=attention.device)
        augmented = augmented / augmented.sum(-1, keepdim=True)
        joint = augmented if joint is None else augmented @ joint
    if joint is None:
        raise ValueError("No attention layers returned")
    patches = joint[0, 1:]
    patches = patches / patches.sum()
    side = int(np.sqrt(patches.numel()))
    if side * side != patches.numel():
        raise ValueError("Patch tokens must form a square grid")
    return patches.reshape(side, side).cpu().numpy()
