PYTHON ?= python3
ARGS ?=
export PYTHONPATH := $(CURDIR)/src
# Set before Python/CUDA initialize.
export PYTHONHASHSEED := 0
export CUBLAS_WORKSPACE_CONFIG := :4096:8

.PHONY: train eval test
train: CONFIG ?= configs/default.yaml
train:
	$(PYTHON) scripts/train.py --config $(CONFIG) $(ARGS)

eval: CONFIG ?= configs/ablation.yaml
eval:
	$(PYTHON) scripts/evaluate.py --config $(CONFIG) $(ARGS)

test:
	$(PYTHON) -m pytest tests -q
