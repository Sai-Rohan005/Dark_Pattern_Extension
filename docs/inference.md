# Local screenshot inference

The CLI takes a screenshot plus its plain text or HTML snapshot and returns JSON
containing `prediction`, `label`, `probability_dark_pattern` and `confidence`.
Confidence is the predicted class's probability, not a calibrated reliability
estimate. This uses a single seeded research head; it is not the mean-score
ensemble used to rank errors.

## Export a verified head

The original ablation run saved predictions but not trained heads. Export
recovers the selected seed with the original training/validation protocol and
requires its probabilities to match the saved run before writing a checkpoint.
It checks the original manifest, feature provenance and prediction hashes.
No threshold, epoch or hyperparameter is selected using test performance.

```sh
PYTHONPATH=src python scripts/export_head.py \
  --results results --seed 42 --output checkpoints/fusion-seed42.pt
```

The bundle contains projection/fusion weights, training-only normalization,
feature dimensions, fixed threshold, encoder hashes and export provenance.
Output must be a fresh file. Weights remain ignored by Git. Original measured
reports are preserved; the recovery is not a new evaluation result.

## Predict

Use the same pinned local encoder snapshot downloaded during feature
extraction. A different weight set is rejected against the exported head's
encoder hashes.

```sh
PYTHONPATH=src python scripts/infer.py \
  --screenshot /absolute/path/screenshot.png \
  --text-file /absolute/path/screenshot.txt \
  --head checkpoints/fusion-seed42.pt \
  --snapshot runs/hf-cache/models--sai-Rohan--Dark_pattern_Detection_models/snapshots/857a8bf57ffa4b8b809daa85a90a536b04a3302c
```

Replace `--text-file` with `--dom-file /absolute/path/page.html` to extract text
from HTML. Exactly one is required. The parser excludes head/script/style,
template and explicitly hidden content, decodes entities, and normalizes
whitespace. It does not reconstruct browser visibility, CSS layout, dynamic
content or accessibility trees. Supply the matching rendered text when those
details matter.

Screenshot pixels enter DINOv2. Supplied text enters ModernBERT. UI graph nodes
come from screenshot-detected widgets using the evaluated YOLO/GAT pipeline;
DOM geometry does not silently replace the graph representation. The output
identifies the text and graph sources, truncation status and graph size.
DOM-derived text can differ from training OCR, so prior OCR-based metrics do
not establish DOM-input performance.

The model loads locally on CPU. The CLI writes one JSON object to stdout and
model-library logs to stderr; malformed inputs or incompatible checkpoints exit
unsuccessfully. It requires neither a web service nor a Hugging Face Space.
Model downloads remain a separate preparation step through feature extraction.

## Tests

```sh
python -m pip install -r requirements.txt
make test
```

Pytest also collects the earlier unittest cases. The new tests cover:

- Manifest ordering, labels, split separation, image identity and feature cache
  alignment; corrupted cache data and provenance are rejected.
- Graph shapes, node normalization, edge index bounds/uniqueness, directed
  containment, reciprocal row relations, reading order and empty/single nodes
  on a synthetic fixture page in `tests/fixtures/`.
- Forward passes through real DINOv2, ModernBERT and GAT implementations using
  tiny random test configurations; no weights are downloaded.
- Every active modality combination in the projection/fusion head, including
  backward propagation through its active branches.
- Inference normalization, probability/confidence semantics, invalid features,
  unverified checkpoints, DOM parsing and extraction orchestration.

Synthetic fixtures verify behavior, not model accuracy. The actual pretrained
encoder/head path is checked separately against the saved experiment and a
real screenshot/text input. Dataset and model limitations in the evaluation
and error-analysis reports still apply.
