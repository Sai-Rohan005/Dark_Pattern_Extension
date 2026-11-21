"""Error ranking and pattern slices from saved held-out predictions only."""
from collections import defaultdict
import csv
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from dpd.data.audit import sha256, write_csv
from dpd.evaluation.ablation import COMBINATIONS, load_splits
from dpd.evaluation.metrics import METRICS, binary_metrics

FULL = "visual+text+graph"


def rank_errors(rows, probabilities, threshold=.5, limit=20):
    errors = []
    for row, probability in zip(rows, probabilities):
        predicted = int(probability >= threshold)
        if predicted != row["label"]:
            kind = "FP" if predicted else "FN"
            errors.append(dict(row, error_type=kind, probability=float(probability),
                               wrong_class_confidence=float(probability if predicted else 1 - probability)))
    return [dict(row, rank=i + 1) for kind in ("FP", "FN")
            for i, row in enumerate(sorted([r for r in errors if r["error_type"] == kind],
                                           key=lambda r: (-r["wrong_class_confidence"], r["file_name"]))[:limit])]


def crop_geometry(width, height, image_size=224):
    resize = int(image_size * 256 / 224)
    scale = resize / min(width, height)
    new_w, new_h = max(1, round(width * scale)), max(1, round(height * scale))
    left, top = (new_w - image_size) // 2, (new_h - image_size) // 2
    return (left * width / new_w, top * height / new_h,
            (left + image_size) * width / new_w, (top + image_size) * height / new_h)


def bbox_coverage(box, crop):
    x, y, w, h = box
    overlap = max(0, min(x + w, crop[2]) - max(x, crop[0])) * max(0, min(y + h, crop[3]) - max(y, crop[1]))
    return overlap / (w * h)


def pattern_slice(rows, annotations, pattern):
    # Other positive types are excluded, never relabeled as benign controls.
    return np.array([r["label"] == 0 or pattern in annotations[r["file_name"]] for r in rows])


def read_patterns(root, rows):
    annotations, boxes, paths, vocabulary = defaultdict(set), defaultdict(list), [], set()
    for platform in ("web", "mobile"):
        path = Path(root) / f"AidUi_evaluation/{platform}/bounding-boxes.json"
        source = json.loads(path.read_text())
        paths.append(path)
        names = {r["id"]: Path(r["file_name"]).name for r in source["images"]}
        cats = {r["id"]: r["name"] for r in source["categories"]}
        vocabulary.update(set(cats.values()) - {"NO DP"})
        for ann in source["annotations"]:
            name, category = names[ann["image_id"]], cats[ann["category_id"]]
            if category != "NO DP":
                annotations[name].add(category)
                boxes[name].append(ann["bbox"])
    for row in rows:
        if int(bool(annotations[row["file_name"]])) != row["label"]:
            raise ValueError(f"Pattern annotations disagree with binary labels: {row['file_name']}")
    return annotations, boxes, sorted(vocabulary), paths


def analyze(results, dataset_root, output, limit=20):
    results, output = Path(results), Path(output)
    if limit < 1:
        raise ValueError("limit must be positive")
    output.mkdir(parents=True, exist_ok=False)
    assets = output / "assets"
    assets.mkdir()
    record = json.loads((results / "provenance.json").read_text())
    if record["status"] != "complete":
        raise ValueError("A complete ablation experiment is required")
    rows, hashes = load_splits(record["config"])
    if hashes != record["split_sha256"]:
        raise ValueError("Split manifests changed since the scored experiment")
    rows = [r for r in rows if r["split"] == "test"]
    if [r["sample_id"] for r in rows] != record["test_order"]:
        raise ValueError("Held-out ordering changed")
    seeds, threshold = record["config"]["evaluation"]["seeds"], record["config"]["evaluation"]["threshold"]
    variants = ["+".join(c) for c in COMBINATIONS] + ["tfidf_logistic"]
    predictions, inputs = {}, {str(results / "provenance.json"): sha256(results / "provenance.json")}
    for variant in variants:
        values = []
        for seed in seeds:
            path = results / "predictions" / f"{variant}-{seed}.csv"
            digest = sha256(path)
            if digest != record["prediction_sha256"][path.name]:
                raise ValueError(f"Predictions changed: {path}")
            with path.open(newline="") as handle:
                saved = list(csv.DictReader(handle))
            if [r["sample_id"] for r in saved] != record["test_order"]:
                raise ValueError("Prediction order differs across models/seeds")
            if any(r["file_name"] != s["file_name"] or r["label"] != str(s["label"]) for r, s in zip(saved, rows)):
                raise ValueError("Prediction identity/label mismatch")
            values.append([float(r["probability"]) for r in saved])
            inputs[str(path)] = digest
        predictions[variant] = np.array(values)
    labels = np.array([r["label"] for r in rows])
    patterns, boxes, vocabulary, sources = read_patterns(dataset_root, rows)
    inputs.update({str(p): sha256(p) for p in sources})
    means = {name: values.mean(0) for name, values in predictions.items()}
    errors = rank_errors(rows, means[FULL], threshold, limit)
    index = {r["file_name"]: i for i, r in enumerate(rows)}
    error_rows = []
    for row in errors:
        name, i = row["file_name"], index[row["file_name"]]
        with Image.open(row["image_path"]) as image:
            screenshot = image.convert("RGB")
        crop = crop_geometry(screenshot.width, screenshot.height)
        coverages = [bbox_coverage(box, crop) for box in boxes[name]]
        draw = ImageDraw.Draw(screenshot)
        for box in boxes[name]:
            x, y, w, h = box
            draw.rectangle((x, y, x + w, y + h), outline="red", width=4)
        draw.rectangle(crop, outline="lime", width=4)
        filename = f"{row['error_type']}-{row['rank']:02d}-{row['sample_id']}.png"
        screenshot.save(assets / filename)
        entry = dict(error_type=row["error_type"], rank=row["rank"], sample_id=row["sample_id"], file_name=name,
                     label=row["label"], probability=row["probability"], wrong_class_confidence=row["wrong_class_confidence"],
                     patterns="; ".join(sorted(patterns[name])) or "NO DP", screenshot=f"assets/{filename}",
                     max_dp_box_crop_coverage=max(coverages) if coverages else "",
                     min_dp_box_crop_coverage=min(coverages) if coverages else "",
                     seeds_misclassified=int(np.sum((predictions[FULL][:, i] >= threshold) != row["label"])))
        for variant in variants:
            entry[variant + "_mean_probability"] = float(means[variant][i])
        error_rows.append(entry)
    write_csv(output / "confident_errors.csv", error_rows)
    pattern_results, per_seed = [], []
    for variant in variants:
        for pattern in vocabulary:
            mask = pattern_slice(rows, patterns, pattern)
            positive = int(np.sum(labels[mask] == 1))
            negative = int(np.sum(labels[mask] == 0))
            entry = dict(variant=variant, pattern=pattern, positive_support=positive, negative_controls=negative,
                         status="available" if positive and negative else "no_test_support")
            values = []
            if positive and negative:
                for seed, probability in zip(seeds, predictions[variant]):
                    measured = binary_metrics(labels[mask], probability[mask], threshold)
                    per_seed.append(dict(variant=variant, pattern=pattern, seed=seed, **measured))
                    values.append(measured)
            for metric in METRICS:
                entry[metric + "_mean"] = float(np.mean([v[metric] for v in values])) if values else ""
                entry[metric + "_std"] = float(np.std([v[metric] for v in values], ddof=1)) if values else ""
            pattern_results.append(entry)
    write_csv(output / "pattern_metrics.csv", pattern_results)
    write_csv(output / "pattern_per_seed.csv", per_seed)
    modality_rows = []
    for variant in variants:
        fp = np.sum((predictions[variant] >= threshold) & (labels == 0), axis=1)
        fn = np.sum((predictions[variant] < threshold) & (labels == 1), axis=1)
        modality_rows.append(dict(variant=variant, fp_mean=float(fp.mean()), fp_std=float(fp.std(ddof=1)),
                                  fn_mean=float(fn.mean()), fn_std=float(fn.std(ddof=1))))
    write_csv(output / "modality_errors.csv", modality_rows)
    # Contact sheet contains only actual errors; no fabricated filler examples.
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    if error_rows:
        nrows = (len(error_rows) + 1) // 2
        fig, axes = plt.subplots(nrows, 2, figsize=(12, nrows * 3.5), squeeze=False)
        for ax in axes.flat:
            ax.axis("off")
        for ax, row in zip(axes.flat, error_rows):
            with Image.open(output / row["screenshot"]) as image:
                ax.imshow(image)
            ax.set_title(f"{row['error_type']} #{row['rank']} | confidence {row['wrong_class_confidence']:.3f}\n{row['file_name']}", fontsize=9)
        fig.tight_layout()
        fig.savefig(assets / "error_contact_sheet.png", dpi=150)
        plt.close(fig)
    lines = ["# Held-out error analysis", "", f"Scope: {record['scope']}. Test screenshots: {len(rows)}.",
             f"Ranking uses mean P(DP) over the seeded full-fusion models ({', '.join(map(str, seeds))}), threshold {threshold}. This is a derived ensemble ranking, separate from the per-seed ablation metrics.",
             "Wrong-class confidence is P(DP) for false positives and 1−P(DP) for false negatives. These scores are not calibrated confidence estimates.", "",
             f"Requested up to {limit} unique examples per error type; found {sum(r['error_type']=='FP' for r in error_rows)} false positives and {sum(r['error_type']=='FN' for r in error_rows)} false negatives. No examples are duplicated to fill the quota.", "",
             "![Error overview](assets/error_contact_sheet.png)", "",
             "## Pattern-specific binary detection", "",
             "Each slice contains screenshots annotated with that pattern plus the same benign controls. Other positive types are excluded, not relabeled negative. Mixed-pattern screenshots can occur in several slices; rows are not additive. This measures binary DP detection within a type, not pattern classification.",
             "The table summarizes the original per-seed full-fusion predictions, not the mean-probability ensemble. Precision/recall/F1 are positive-class metrics; PR-AUC is trapezoidal. Values are mean ± sample SD.", "",
             "| Original pattern label | Positive support | Benign controls | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |",
             "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for row in pattern_results:
        if row["variant"] != FULL:
            continue
        values = [f"{row[m+'_mean']:.3f} ± {row[m+'_std']:.3f}" if row["status"] == "available" else "—"
                  for m in ("accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc")]
        lines.append("| " + " | ".join([row["pattern"], str(row["positive_support"]), str(row["negative_controls"])] + values) + " |")
    lines += ["", "Confirmshaming and hidden costs are not labels in these source annotations. They cannot receive verified category scores; absence from the vocabulary does not prove absence from screenshots. Original countdown/limited-time/low-stock labels are retained instead of inventing an urgency mapping.",
              "All variants and exact per-seed slice metrics are in pattern_metrics.csv and pattern_per_seed.csv. Support is small; do not treat a perfect single-example rate as generalization evidence.", "",
              "## Modality error profile", "", "| Variant | False positives, mean ± SD | False negatives, mean ± SD |", "| --- | ---: | ---: |"]
    for row in modality_rows:
        lines.append(f"| {row['variant']} | {row['fp_mean']:.3f} ± {row['fp_std']:.3f} | {row['fn_mean']:.3f} ± {row['fn_std']:.3f} |")
    lines += ["", "## Ranked screenshots", "", "Red boxes mark annotated DP regions; green marks the DINO crop footprint. Benign screenshots have no red DP boxes. Original images stay in ignored assets, not committed datasets."]
    for kind in ("FP", "FN"):
        lines += ["", "### " + ("False positives" if kind == "FP" else "False negatives")]
        for row in error_rows:
            if row["error_type"] != kind:
                continue
            lines += ["", f"#### {kind} {row['rank']}: {row['file_name']}", "",
                      f"P(DP)={row['probability']:.4f}; wrong-class confidence={row['wrong_class_confidence']:.4f}; seeded models wrong={row['seeds_misclassified']}/{len(seeds)}. Labels: {row['patterns']}.",
                      f"Visual-only P(DP)={row['visual_mean_probability']:.4f}, text-only={row['text_mean_probability']:.4f}, graph-only={row['graph_mean_probability']:.4f}. These are separate trained heads, not causal contributions."]
            if row["max_dp_box_crop_coverage"] != "":
                lines.append(f"Fraction of each annotated DP box inside the visual crop ranges from {row['min_dp_box_crop_coverage']:.3f} to {row['max_dp_box_crop_coverage']:.3f}. Box overlap is geometric evidence, not attention attribution.")
            lines += ["", f"![{row['file_name']}]({row['screenshot']})"]
    (output / "report.md").write_text("\n".join(lines) + "\n")
    metadata = dict(source_results_sha256=inputs, source_script_sha256=sha256(__file__), seeds=seeds,
                    threshold=threshold, requested_per_type=limit, test_samples=len(rows),
                    false_positives=sum(r["error_type"] == "FP" for r in error_rows),
                    false_negatives=sum(r["error_type"] == "FN" for r in error_rows),
                    ranking="Mean probability across seeded full-fusion heads; unique held-out screenshots",
                    patterns=vocabulary, screenshot_sha256={p.name: sha256(p) for p in assets.glob("*.png")})
    (output / "provenance.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps({k: metadata[k] for k in ("test_samples", "false_positives", "false_negatives", "patterns")}, indent=2))
    return output
