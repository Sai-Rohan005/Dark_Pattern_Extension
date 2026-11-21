PYTHON ?= python3
CONFIG ?= configs/default.yaml
ARGS ?=
export PYTHONPATH := $(CURDIR)/src
# Set before Python/CUDA initialize.
export PYTHONHASHSEED := 0
export CUBLAS_WORKSPACE_CONFIG := :4096:8

.PHONY: train eval test
train:
	$(PYTHON) scripts/train.py --config $(CONFIG) $(ARGS)

eval:
	$(PYTHON) scripts/evaluate.py --config $(CONFIG) $(ARGS)

test:
	$(PYTHON) -m unittest discover -s tests -v
