# Held-out modality ablations

Run the exact split manifests from the [dataset audit](dataset.md). The supplied
historical manifest has confirmed leakage and is not used for these experiments.
The configured corrected split covers the identifiable web subset; mobile and
unidentified web screenshots remain excluded. This is a limited pilot, not a
full-corpus evaluation or a certified test on unseen encoder-pretraining sites.

## Comparisons

The runner trains a fresh projection/concatenation classifier for visual-only,
text-only, graph-only, visual+text, visual+graph, text+graph and full fusion.
The visual, text and graph encoders are frozen. Each active branch has its own
linear projection, layer normalization, GELU and dropout, followed by
concatenation and a binary linear head. Excluded branches do not enter the
model. This is a controlled concat-fusion experiment, not a reproduction of
the deployed weighted-fusion classifier or its previous scores.

The baseline is TF-IDF word unigrams/bigrams plus logistic regression. Vocabulary
and IDF are learned on training text only. Both the baseline and ModernBERT use
the same text extracted from screenshot pixels; filenames, DP annotations and
site IDs are not text features. Raw OCR differs from the deployed service's
structured-widget serialization, so this experiment must not be presented as
an exact deployed-pipeline evaluation.

The dataset split stays fixed across every variant and seed. The seed list,
optimizer settings, feature dimensions, epochs and threshold are in
`configs/ablation.yaml`. A minimum of three distinct seeds is enforced. The
runner verifies image hashes, unique samples, both labels per split, and
disjoint site/app groups, file hashes and decoded pixel hashes before fitting.
Missing source identity records are not silently admitted.

Standardization is fitted separately on training embeddings only. Every
variant/seed initializes a fresh head and receives the same seeded training
sample order. Validation loss selects the epoch; threshold and hyperparameters
are fixed before test scoring. Test labels do not select checkpoints, epochs,
thresholds or TF-IDF vocabulary. The deterministic baseline is refitted for
each configured seed; its seed deviation can legitimately be zero.

## Prepare inputs

Install `requirements.txt` in a dedicated environment and reproduce the dataset
audit to create the configured train/validation/test manifests. OCR extraction
uses on-device macOS Vision, accurate recognition, English and language
correction. It requires macOS and the Swift compiler. Errors stop extraction;
an actually empty OCR result remains an empty document and is counted.

```sh
PYTHONPATH=src python scripts/extract_ocr.py --config configs/ablation.yaml
PYTHONPATH=src python scripts/extract_features.py --config configs/ablation.yaml
make eval CONFIG=configs/ablation.yaml
```

Feature extraction downloads the user-provided repository
`sai-Rohan/Dark_pattern_Detection_models` at the immutable revision recorded in
the extraction script and provenance. It loads DINOv2, ModernBERT, YOLO and GAT
weights, and uses the matching graph schema. DINOv2 and GAT state dictionaries
must match strictly. Widget class order must match the schema. Graph nodes
come from predicted widgets, never annotated DP boxes. Empty graphs use the
GAT checkpoint's learned empty embedding; failures do not silently become zero
features. Encoder pretraining membership remains unverified.

`--snapshot /path/to/pinned/snapshot` reuses a local downloaded model snapshot.
The feature cache records the image and feature hashes and encoder provenance.
All modalities must exist for every sample; there is no per-variant filtering
that would change the held-out set. The classifier cannot accept a stale
feature index whose image hashes differ.

OCR, features, downloaded weights and predictions remain ignored. To use
another OCR implementation, provide JSON entries with `file_name`, `text`,
`image_sha256` and a sibling `provenance.json` containing its `text_sha256` and
extraction details. To use an existing feature cache, provide a CSV with
`file_name,feature_path,image_sha256,feature_sha256`; each NPZ must contain
finite vectors `visual_feature`, `text_feature`, `graph_feature`, and a sibling
`provenance.json` must identify the encoders. Checkpoints used to adapt encoders
must have their training provenance reviewed before interpreting generalization.

Use fresh OCR/cache paths and a fresh results directory for another experiment.
The runner refuses to overwrite an existing `ablation.csv`.

## Outputs and definitions

- `results/ablation.csv`: one row per comparison, means and sample standard
  deviations across the full configured seed list, with status and seed count.
- `results/ablation.md`: the same values rendered as a Markdown table.
- `results/ablation_per_seed.csv`: script-produced accuracy, precision, recall,
  F1, ROC-AUC, PR-AUC and TN/FP/FN/TP for each completed model and seed.
- `results/predictions/`: per-sample probabilities and decisions for audit.
- `results/provenance.json`: configuration, installed versions, source hashes,
  split/feature/text hashes, test ordering and failure details.

The positive class is DARK PATTERN. Precision/recall/F1 use the positive class
with zero-division results set to zero. ROC-AUC and PR-AUC use probabilities.
PR-AUC is trapezoidal integration of the precision-recall curve, **not**
average precision. Confusion matrices use actual labels as rows and predicted
labels as columns: `[[TN, FP], [FN, TP]]`. Their aggregate entries have means
and sample deviations, so they need not be integers; exact per-seed counts are
preserved. Standard deviations use `ddof=1` and measure training randomness,
not uncertainty over sites or a confidence interval for population performance.

A comparison receives aggregate scores only if every configured seed completes.
Blocked comparisons have blank metric fields, an explanation, and cause a
nonzero command exit. Prior downloaded ablation CSVs, plots and synthetic test
outputs are never imported into the research report.

## Limits

The held-out web subset is small and differs in class balance from training.
Domain grouping cannot catch every shared template, owner or near duplicate.
Encoder training manifests were not supplied, so test-site exclusion from
pretraining is unverified. OCR uses a platform-specific English recognizer, and
recognition errors can affect both text approaches. Frozen-feature heads do
not establish the performance of end-to-end fine tuning or the deployed
classifier. Synthetic unit tests validate protocol behavior only and are not
research evidence.
