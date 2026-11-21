"""Render rollout maps for the most confident available FP/FN screenshots."""
import argparse
import csv
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
import torch
from transformers import Dinov2Config, Dinov2Model

from dpd.data.audit import sha256
from dpd.evaluation.attention import attention_rollout
from dpd.models.ui_graph import DinoPreprocessor, IMAGENET_MEAN, IMAGENET_STD
from dpd.reproducibility import seed_everything


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", default="results")
    parser.add_argument("--analysis", default="results/error_analysis")
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--per-type", type=int, default=2)
    args = parser.parse_args()
    results, analysis, snapshot = Path(args.results), Path(args.analysis), Path(args.snapshot)
    if args.per_type < 1:
        raise ValueError("per-type must be positive")
    if (analysis / "attention_provenance.json").exists():
        raise ValueError("Attention report exists; use a fresh analysis directory")
    record = json.loads((results / "provenance.json").read_text())
    feature_info = record["features"]["provenance"]
    seed_everything(record["config"]["seed"], True)
    torch.set_num_threads(4)
    checkpoint_path = snapshot / "dino.pt"
    if sha256(checkpoint_path) != feature_info["model_sha256"]["dino.pt"]:
        raise ValueError("DINO weights differ from the evaluated feature extractor")
    feature_manifest = Path(record["config"]["evaluation"]["feature_manifest"])
    if sha256(feature_manifest) != record["features"]["manifest_sha256"]:
        raise ValueError("Feature index changed")
    feature_index = {r["file_name"]: r for r in csv.DictReader(feature_manifest.open())}
    errors = list(csv.DictReader((analysis / "confident_errors.csv").open()))
    selected = [r for kind in ("FP", "FN") for r in [x for x in errors if x["error_type"] == kind][:args.per_type]]
    rows = {}
    for path in record["config"]["data"].values():
        rows.update({r["file_name"]: r for r in csv.DictReader(Path(path).open())})
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    raw = checkpoint.get("teacher", checkpoint.get("student", checkpoint))
    state = {key.removeprefix("module.").removeprefix("backbone."): value for key, value in raw.items()
             if key.removeprefix("module.").startswith("backbone.")}
    config = Dinov2Config.from_dict(feature_info["dino_config"])
    config._attn_implementation = "eager"
    model = Dinov2Model(config)
    model.load_state_dict(state, strict=True)
    model.eval().requires_grad_(False)
    del checkpoint, raw, state
    crop_size = json.loads((snapshot / "config.json").read_text())["visual"]["image_size"]
    preprocess = DinoPreprocessor(crop_size)
    generated = []
    for error in selected:
        name = error["file_name"]
        row, entry = rows[name], feature_index[name]
        if row["split"] != "test" or sha256(row["image_path"]) != row["file_sha256"]:
            raise ValueError("Attention examples must be unchanged held-out screenshots")
        if sha256(entry["feature_path"]) != entry["feature_sha256"]:
            raise ValueError("Cached feature changed")
        with Image.open(row["image_path"]) as image:
            tensor = preprocess(image)
        with torch.inference_mode():
            output = model(pixel_values=tensor.unsqueeze(0), output_attentions=True)
        with np.load(entry["feature_path"], allow_pickle=False) as cached:
            original = cached["visual_feature"]
        actual = output.pooler_output.squeeze(0).numpy()
        np.testing.assert_allclose(actual, original, rtol=1e-4, atol=2e-5)
        difference = float(np.max(np.abs(actual - original)))
        rollout = attention_rollout(output.attentions)
        heatmap = torch.nn.functional.interpolate(torch.tensor(rollout)[None, None],
                                                  size=(crop_size, crop_size), mode="bilinear", align_corners=False)[0, 0].numpy()
        crop = np.clip(tensor.permute(1, 2, 0).numpy() * IMAGENET_STD + IMAGENET_MEAN, 0, 1)
        fig, axes = plt.subplots(1, 3, figsize=(15, 5), gridspec_kw={"width_ratios": [2, 1, 1]})
        with Image.open(analysis / error["screenshot"]) as screenshot:
            axes[0].imshow(screenshot)
        axes[0].set_title("Original screenshot: green=DINO crop; red=DP label")
        axes[1].imshow(crop)
        axes[1].set_title("Actual encoder input")
        axes[2].imshow(crop)
        overlay = axes[2].imshow(heatmap, cmap="magma", alpha=.65, vmin=0, vmax=float(heatmap.max()))
        axes[2].set_title("CLS attention rollout")
        for ax in axes:
            ax.axis("off")
        fig.colorbar(overlay, ax=axes[2], fraction=.05, pad=.03, label="Relative patch mass")
        fig.suptitle(f"{error['error_type']}: {name}\nEncoder attention only; not fusion-logit attribution", fontsize=11)
        fig.tight_layout()
        filename = f"attention-{error['error_type']}-{error['rank']}-{error['sample_id']}.png"
        path = analysis / "assets" / filename
        fig.savefig(path, dpi=160)
        plt.close(fig)
        np.savez_compressed(path.with_suffix(".npz"), rollout=rollout)
        generated.append(dict(file_name=name, visualization=f"assets/{filename}",
                              png_sha256=sha256(path), rollout_sha256=sha256(path.with_suffix(".npz")),
                              cached_embedding_max_abs_difference=difference,
                              layers=len(output.attentions), heads=output.attentions[0].shape[1],
                              patch_grid=list(rollout.shape)))
        print(f"Rendered {name}; cached embedding max difference={difference}", flush=True)
    report = analysis / "report.md"
    section = ["", "## Encoder attention visualizations", "",
               "Maps use the evaluated frozen DINOv2 checkpoint and preprocessing. Cached embeddings are reproduced within the recorded floating-point tolerance. Heads are averaged, residual identity is added, rows are normalized, and attention matrices are multiplied across layers; CLS-to-patch mass is displayed on the actual crop.",
               "This is [attention rollout](https://arxiv.org/abs/2005.00928), not GradCAM and not a class-specific causal explanation. The fusion head has no attention layer. Its trained states were not saved in the original experiment, so no classifier-gradient attribution is claimed. Per-example color scales differ and cannot be compared as absolute importance.", ""]
    for item in generated:
        section += [f"### {item['file_name']}", "", f"![DINOv2 encoder attention]({item['visualization']})", ""]
    report.write_text(report.read_text() + "\n".join(section))
    metadata = dict(method="Mean-head residual attention rollout; encoder CLS token to input patches",
                    class_specific=False, source_script_sha256=sha256(__file__),
                    method_source_sha256=sha256(Path(__file__).resolve().parents[1] / "src/dpd/evaluation/attention.py"),
                    evaluated_dino_sha256=sha256(checkpoint_path), results_sha256=sha256(results / "provenance.json"),
                    error_csv_sha256=sha256(analysis / "confident_errors.csv"), examples=generated)
    (analysis / "attention_provenance.json").write_text(json.dumps(metadata, indent=2) + "\n")


if __name__ == "__main__":
    main()
