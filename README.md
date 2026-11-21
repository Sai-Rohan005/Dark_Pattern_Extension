# Multimodal Dark Pattern Detection

Research scaffold for binary classification using DINOv2 visual features,
ModernBERT text features, and a Graph Attention Network for UI layout, followed
by projection layers and multimodal fusion.

## Status

Frozen-encoder feature extraction, fusion-head ablations and a TF-IDF baseline
are implemented; see [evaluation protocol](docs/evaluation.md). General encoder
training and the default training entrypoint remain TODO.
The existing `backend/` serves an external Hugging Face model; browser clients
live in `extension/`, `extension_react/`, and `extension_react_firefox/`.
They remain separate from this research scaffold.
Datasets and checkpoints remain ignored. Script-generated pilot results are
available in [the ablation table](results/ablation.md).

## Layout

```text
src/dpd/
  data/             # dataset audit and grouped split construction
  models/           # UI graph construction, frozen GAT, projections and fusion
  training/         # TODO: optimization and checkpointing
  evaluation/       # shared ablation protocol and binary metrics
  cli.py            # shared command setup
  reproducibility.py
configs/            # YAML hyperparameters
scripts/            # train/eval entrypoints
tests/
docs/
requirements.txt    # pinned direct research dependencies
Makefile
```

## Setup

Use a dedicated Python environment. Dependency installation and accelerator
compatibility must be verified on the target machine before running experiments.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
make test PYTHON=python
```

Serving dependencies are managed separately in `backend/requirements.txt`.
The research requirements pin direct dependencies, not a complete transitive
lock. Every setup run records installed distribution versions.

## Commands

```sh
make train
make eval
# Setup validation only (does not load data, models, or checkpoints):
make train ARGS=--dry-run
make eval ARGS=--dry-run
# Override the interpreter or configuration:
make train PYTHON=.venv/bin/python CONFIG=configs/default.yaml ARGS=--dry-run
```

`make train` retains the training scaffold. `make eval` defaults to the ablation
config and runs the evaluation protocol:

```sh
make eval
```

Prepare its audited split manifests, OCR and frozen feature cache first, as
described in the evaluation documentation. Missing inputs are reported as
blocked with blank scores and a nonzero exit status.
Paths in the YAML are relative to the working directory (normally the repo root).

## Configuration and reproducibility

Edit `configs/default.yaml`; values are initial choices, not tuned results.
Each invocation saves the resolved YAML and environment JSON in a unique folder
under ignored `runs/`. Provenance includes a config hash, installed packages,
Python/platform, Git revision and dirty state, and CUDA/cuDNN details.
Python, NumPy, PyTorch and CUDA RNGs are seeded; deterministic PyTorch algorithms
are enabled by default. Make sets Python's hash seed before interpreter startup
and the cuBLAS workspace environment before CUDA initialization.

When implementing loaders, pass the generator from `seed_everything` and
`seed_worker` as the DataLoader's `generator` and `worker_init_fn`.
Pin immutable encoder revisions and record dataset/split hashes before real
experiments. Determinism can reject unsupported operations; equal seeds do not
guarantee identical results across devices or library versions. Dirty runs need
their source changes archived separately to be reconstructable.

## Data and limitations

See the [dataset audit](docs/dataset.md) for local AIDUI counts, provenance,
annotation and graph details, measured leakage, and corrected grouped web
manifests. Full app-safe splitting remains pending source identity metadata.
The reported pilot uses only the identifiable web subset; it does not measure
mobile performance or prove exclusion of test sites from encoder pretraining.

## Results

The evaluation runner writes `results/ablation.csv`, `results/ablation.md`,
per-seed metrics and provenance. Only completed runs receive aggregate scores.
Never reuse the historical leaking split for claims about unseen sites/apps.
The checked-in [CSV](results/ablation.csv) and [table](results/ablation.md) were
produced by the configured experiment, including weak and zero-F1 results.

## Development

```sh
make test
```

Do not commit datasets, model weights, checkpoints, generated runs, credentials,
or virtual environments. Implement and validate the research pipeline before
using these entrypoints for experiments.
