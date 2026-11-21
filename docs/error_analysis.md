# Error analysis workflow

The generated [report](../results/error_analysis/report.md) analyzes saved
predictions from the completed ablation experiment. No model fitting or
threshold selection takes place during error analysis. Input prediction,
manifest and screenshot hashes are checked against the original experiment.

Run from the repo root in the pinned environment, using a fresh analysis output
directory. The snapshot argument is the same pinned model snapshot used for
feature extraction:

```sh
PYTHONPATH=src python scripts/analyze_errors.py \
  --dataset-root /Users/rohittanuku/Downloads/major_project_dataset
PYTHONPATH=src python scripts/visualize_attention.py \
  --snapshot runs/hf-cache/models--sai-Rohan--Dark_pattern_Detection_models/snapshots/857a8bf57ffa4b8b809daa85a90a536b04a3302c
PYTHONPATH=src python scripts/discuss_errors.py \
  --snapshot runs/hf-cache/models--sai-Rohan--Dark_pattern_Detection_models/snapshots/857a8bf57ffa4b8b809daa85a90a536b04a3302c
make test
```

`--results` and `--analysis` select alternative result/analysis directories for
the visualization and discussion scripts. The first script uses `--output` for
its destination. Screenshot assets are generated locally and ignored to avoid
committing dataset images. Preserve that folder when sharing a permitted local
copy of the report; its Markdown embeds reference those files.

## Interpretation

The ranking averages full-fusion probabilities over the experiment's training
seeds, then applies its fixed threshold. It is an explicitly derived ensemble
view, not a replacement for the original per-seed metrics. False positives rank
by P(DP), false negatives by 1−P(DP). Each screenshot occurs once. `--limit`
defaults to the requested maximum per type; missing examples are not padded
with duplicates, synthetic screenshots or training-set errors. Confidence
scores are uncalibrated.

`confident_errors.csv` records ranks, confidence, labels, crop/annotation overlap
and single/pairwise modality scores. `pattern_metrics.csv` and
`pattern_per_seed.csv` contain all ablation variants. A pattern slice consists
of positives carrying the original pattern label plus the common benign
controls. Other positives are excluded. Mixed-pattern screenshots can belong to
multiple slices, and rows are not additive. The model is a binary detector;
these are conditional binary detection scores, not multiclass pattern
recognition. Types with no positive test support have blank metrics.

The attention script checks the evaluated DINO checkpoint hash and reconstructs
its encoder inputs. It verifies the resulting embeddings against the scored
cache before plotting. It averages attention heads, adds residual identity,
normalizes rows, and multiplies matrices across layers. CLS-to-patch mass is
shown only on the actual center crop. The original screenshot and crop footprint
are included so that excluded annotation regions are visible. Per-example
scales differ; compare spatial patterns rather than color intensity across
screenshots.

This is [attention rollout](https://arxiv.org/abs/2005.00928), **not GradCAM or
fusion-class attribution**. The evaluated concat-fusion head has no attention
weights, and its trained states were not saved. The attention maps are genuine
frozen-encoder outputs but do not prove why the fusion head made a decision.

The discussion script records actual OCR token-budget diagnostics using the
evaluated tokenizer. Lexical cue checks are diagnostics, not new labels or
proof of deception. Its qualitative comments were reviewed against the shown
screenshots for this experiment and need fresh review for a different corpus.
Proposed changes are hypotheses; no improvement metric is claimed.

The report, CSVs and provenance files distinguish measured observations from
interpretation. Dataset scope, incomplete category coverage, uncertain encoder
pretraining overlap and the small held-out set remain material limitations.
