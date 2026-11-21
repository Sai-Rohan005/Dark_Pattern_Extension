# Dataset documentation (to complete before training)

No local research dataset or split manifests were provided with this scaffold.
The external serving model does not establish training provenance or evaluation
quality for this repository. No dataset size, class balance or model performance
is claimed.

Before an experiment, document:

- Source, collection date, permitted uses, license, consent and privacy handling.
- Unit of prediction, label definitions, annotator instructions, disagreement
  handling and adjudication. A screenshot may not reveal interaction history or
  user intent needed to judge deception.
- Coverage of languages, sites, platforms, dark pattern categories, and benign
  examples; class imbalance, missing modalities and exclusions.
- OCR and UI extraction methods, graph node/edge construction and failures.
- Site/template/near-duplicate grouping across splits to reduce leakage; keep
  the held-out test split untouched during hyperparameter and threshold tuning.
- Versioned split manifests and hashes, preprocessing versions and exclusion
  reasons. Keep screenshots, text, personal data and derived features outside Git.

The YAML manifest fields and model hyperparameters are placeholders. A data
schema and implemented loaders must be agreed before training. Evaluation must
report uncertainty, failure cases, and limits on transfer to unseen sites and
languages using outputs from scripts actually run.
