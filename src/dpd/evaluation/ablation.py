"""Shared held-out protocol for frozen-feature fusion and TF-IDF baselines."""
from copy import deepcopy
import csv
import json
from pathlib import Path
import warnings

import numpy as np
from sklearn.exceptions import ConvergenceWarning
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
import torch
from torch import nn

from dpd.data.audit import sha256, write_csv
from dpd.data.loaders import load_splits, load_features
from dpd.evaluation.metrics import METRICS, binary_metrics
from dpd.models.fusion import FeatureFusion
from dpd.reproducibility import environment_versions, seed_everything

COMBINATIONS = (("visual",), ("text",), ("graph",), ("visual", "text"),
                ("visual", "graph"), ("text", "graph"), ("visual", "text", "graph"))






def train_fusion(features, labels, masks, modalities, cfg, seed, artifact_path=None):
    generator = seed_everything(seed, cfg["deterministic"])
    # Every learned normalization is fitted on training data only.
    normalized = {}
    normalization = {}
    for name in modalities:
        scaler = StandardScaler().fit(features[name][masks["train"]])
        normalization[name] = {"mean": torch.tensor(scaler.mean_), "scale": torch.tensor(scaler.scale_)}
        normalized[name] = torch.tensor(scaler.transform(features[name]), dtype=torch.float32)
    model = FeatureFusion({name: features[name].shape[1] for name in modalities}, modalities,
                          cfg["model"]["projection_dim"], cfg["model"]["dropout"])
    settings = cfg["training"]
    optimizer = torch.optim.AdamW(model.parameters(), lr=settings["learning_rate"],
                                 weight_decay=settings["weight_decay"])
    loss_fn = nn.BCEWithLogitsLoss()
    targets = torch.tensor(labels, dtype=torch.float32)
    train = torch.tensor(np.flatnonzero(masks["train"]), dtype=torch.long)
    val = masks["val"]
    best_loss, best_state, best_epoch = float("inf"), None, None
    for epoch in range(settings["epochs"]):
        model.train()
        order = train[torch.randperm(len(train), generator=generator)]
        for batch in order.split(settings["batch_size"]):
            optimizer.zero_grad()
            logits = model({name: x[batch] for name, x in normalized.items()})
            loss = loss_fn(logits, targets[batch])
            if not torch.isfinite(loss):
                raise ValueError("Nonfinite training loss")
            loss.backward()
            optimizer.step()
        model.eval()
        with torch.no_grad():
            val_loss = loss_fn(model({name: x[val] for name, x in normalized.items()}), targets[val]).item()
        if val_loss < best_loss:
            best_loss, best_state, best_epoch = val_loss, deepcopy(model.state_dict()), epoch + 1
    if best_state is None:
        raise ValueError("No finite validation checkpoint")
    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        probability = torch.sigmoid(model({name: x[masks["test"]] for name, x in normalized.items()})).numpy()
    if artifact_path is not None:
        artifact_path = Path(artifact_path)
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        with artifact_path.open("xb") as handle:
            torch.save({"format_version": 1, "state_dict": model.state_dict(),
                        "dimensions": {name: features[name].shape[1] for name in modalities},
                        "modalities": list(modalities), "normalization": normalization,
                        "projection_dim": cfg["model"]["projection_dim"], "dropout": cfg["model"]["dropout"],
                        "seed": seed, "best_epoch": best_epoch, "validation_loss": best_loss}, handle)
    return probability, {"best_epoch": best_epoch, "validation_loss": best_loss}


def run_ablation(config):
    settings = config["evaluation"]
    seeds = settings["seeds"]
    if len(seeds) < 3 or len(set(seeds)) != len(seeds) or any(type(s) is not int or not 0 <= s < 2**32 for s in seeds):
        raise ValueError("Use at least three distinct unsigned integer seeds")
    if not 0 < settings["threshold"] < 1:
        raise ValueError("threshold must be in (0, 1)")
    if config["training"]["epochs"] < 1 or config["training"]["batch_size"] < 1:
        raise ValueError("epochs and batch_size must be positive")
    torch.set_num_threads(settings.get("num_threads", 4))
    rows, split_hashes = load_splits(config)
    labels = np.array([r["label"] for r in rows])
    masks = {name: np.array([r["split"] == name for r in rows]) for name in ("train", "val", "test")}
    output = Path(settings["results_dir"])
    output.mkdir(parents=True, exist_ok=True)
    # Refuse accidental replacement of an existing reported experiment.
    if (output / "ablation.csv").exists():
        raise ValueError("Results already exist; choose a fresh results_dir")
    prediction_dir = output / "predictions"
    prediction_dir.mkdir(exist_ok=True)
    provenance = {"config": config, "environment": environment_versions(), "split_sha256": split_hashes,
                  "scope": settings["dataset_scope"],
                  "threshold_policy": "Fixed before runs; validation loss selects fusion epoch; test never selects hyperparameters",
                  "pr_auc_definition": "Trapezoidal area under precision-recall curve",
                  "std_definition": "Sample standard deviation over training seeds (ddof=1)",
                  "test_order": [r["sample_id"] for r in rows if r["split"] == "test"]}
    package = Path(__file__).resolve().parents[1]
    provenance["source_sha256"] = {str(p.relative_to(package)): sha256(p) for p in (
        Path(__file__), package / "evaluation/metrics.py", package / "models/fusion.py",
        package / "data/loaders.py", package / "reproducibility.py")}
    feature_error, text_error, features, text = None, None, None, None
    try:
        features, provenance["features"] = load_features(settings.get("feature_manifest"), rows)
    except (OSError, ValueError, KeyError) as error:
        feature_error = str(error)
    try:
        text_path = Path(settings["text_manifest"])
        entries = json.loads(text_path.read_text())
        text_index = {r["file_name"]: r["text"] for r in entries}
        if len(text_index) != len(entries):
            raise ValueError("Duplicate OCR filenames")
        identity = {r["file_name"]: r["image_sha256"] for r in entries}
        if any(identity[r["file_name"]] != r["file_sha256"] for r in rows):
            raise ValueError("OCR/image identity mismatch")
        text = np.array([text_index[r["file_name"]] for r in rows])
        provenance["text_manifest_sha256"] = sha256(text_path)
        text_metadata = text_path.with_name("provenance.json")
        provenance["ocr"] = json.loads(text_metadata.read_text())
        if provenance["ocr"]["text_sha256"] != sha256(text_path):
            raise ValueError("OCR provenance hash mismatch")
    except (OSError, ValueError, KeyError, TypeError) as error:
        text_error = str(error)
    per_seed, aggregate, failures = [], [], {}
    variants = [("+".join(names), names) for names in COMBINATIONS] + [("tfidf_logistic", None)]
    for variant, modalities in variants:
        successes, errors = [], []
        missing = feature_error if modalities else text_error
        for seed in seeds:
            if missing:
                errors.append(missing)
                continue
            try:
                seed_everything(seed, config["deterministic"])
                if modalities:
                    probability, details = train_fusion(features, labels, masks, modalities, config, seed)
                else:
                    model = make_pipeline(TfidfVectorizer(ngram_range=(1, 2), max_features=settings["tfidf_max_features"]),
                                          LogisticRegression(C=settings["logistic_c"], solver="liblinear",
                                                             max_iter=2000, random_state=seed))
                    with warnings.catch_warnings():
                        warnings.simplefilter("error", ConvergenceWarning)
                        model.fit(text[masks["train"]], labels[masks["train"]])
                    probability = model.predict_proba(text[masks["test"]])[:, 1]
                    details = {"best_epoch": "", "validation_loss": ""}
                measured = binary_metrics(labels[masks["test"]], probability, settings["threshold"])
                result = dict(variant=variant, seed=seed, **measured, **details)
                per_seed.append(result)
                successes.append(result)
                predictions = [dict(sample_id=r["sample_id"], file_name=r["file_name"],
                                    label=r["label"], probability=float(p),
                                    prediction=int(p >= settings["threshold"]))
                               for r, p in zip([r for r in rows if r["split"] == "test"], probability)]
                write_csv(prediction_dir / f"{variant}-{seed}.csv", predictions)
                print(f"Completed {variant}, seed={seed}", flush=True)
            except (ValueError, RuntimeError, ConvergenceWarning) as error:
                errors.append(f"seed={seed}: {error}")
        completed = len(successes) == len(seeds)
        summary = dict(variant=variant, status="completed" if completed else "blocked",
                       n_seeds=len(successes), seeds=json.dumps(seeds),
                       test_samples=int(masks["test"].sum()), reason="; ".join(sorted(set(errors))))
        for metric in METRICS:
            summary[f"{metric}_mean"] = float(np.mean([r[metric] for r in successes])) if completed else ""
            summary[f"{metric}_std"] = float(np.std([r[metric] for r in successes], ddof=1)) if completed else ""
        aggregate.append(summary)
        if not completed:
            failures[variant] = summary["reason"]
    write_csv(output / "ablation.csv", aggregate)
    write_csv(output / "ablation_per_seed.csv", per_seed)
    provenance["status"] = "complete" if not failures else "incomplete"
    provenance["failures"] = failures
    provenance["prediction_sha256"] = {p.name: sha256(p) for p in sorted(prediction_dir.glob("*.csv"))}
    (output / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    columns = ("accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc")
    lines = ["# Held-out ablation results", "", f"Scope: {settings['dataset_scope']}. Values are mean ± sample standard deviation across the configured training seeds.",
             "PR-AUC is trapezoidal integration. Positive class is DARK PATTERN; confusion matrices are [[TN, FP], [FN, TP]].", "",
             "| Variant | Status | Seeds completed | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | Confusion matrix (mean ± SD) |",
             "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |"]
    for row in aggregate:
        def display(metric):
            return f"{row[metric + '_mean']:.4f} ± {row[metric + '_std']:.4f}" if row["status"] == "completed" else "—"
        matrix = f"[[{display('tn')}, {display('fp')}], [{display('fn')}, {display('tp')}]]" if row["status"] == "completed" else "—"
        lines.append("| " + " | ".join([row["variant"], row["status"], str(row["n_seeds"])] + [display(m) for m in columns] + [matrix]) + " |")
    lines += ["", "All variants use identical split membership, test ordering, seeds and a fixed decision threshold.",
              "Fusion uses freshly trained projection/concatenation heads on frozen embeddings, not inference-time masking of a full model.",
              "Seed standard deviations measure training variation, not confidence intervals over sites. A deterministic baseline may have zero deviation.",
              "Encoder pretraining overlap with these sites is unverified; these are not certified unseen-site results.", ""]
    if failures:
        lines += ["Incomplete comparisons (no aggregate scores reported):", ""] + [f"- {k}: {v}" for k, v in failures.items()]
    (output / "ablation.md").write_text("\n".join(lines) + "\n")
    print(f"Saved {output / 'ablation.csv'} and {output / 'ablation.md'}", flush=True)
    return not failures
