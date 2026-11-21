"""Predict from a screenshot plus its supplied DOM or plain text."""
import argparse
from contextlib import redirect_stdout
import json
from pathlib import Path
import sys

from PIL import Image
import torch

from dpd.data.audit import sha256
from dpd.inference import FusionPredictor, text_from_dom
from dpd.models.encoders import FrozenEncoders
from dpd.reproducibility import seed_everything


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--screenshot", required=True)
    text = parser.add_mutually_exclusive_group(required=True)
    text.add_argument("--text-file", help="UTF-8 screenshot text")
    text.add_argument("--dom-file", help="HTML snapshot; used for text, not graph coordinates")
    parser.add_argument("--head", default="checkpoints/fusion-seed42.pt")
    parser.add_argument("--snapshot", required=True, help="Pinned local encoder snapshot")
    args = parser.parse_args()
    try:
        content = Path(args.text_file or args.dom_file).read_text(encoding="utf-8")
        supplied = content if args.text_file else text_from_dom(content)
        with Image.open(args.screenshot) as original:
            image = original.convert("RGB")
        predictor = FusionPredictor(args.head)
        seed_everything(predictor.bundle["seed"], True)
        torch.set_num_threads(4)
        # Keep stdout machine-readable even if a model library logs to stdout.
        with redirect_stdout(sys.stderr):
            encoders = FrozenEncoders(args.snapshot)
            if encoders.model_hashes != predictor.bundle["encoder_provenance"]["model_sha256"]:
                raise ValueError("Encoder snapshot differs from the exported head's feature pipeline")
            features, diagnostics = encoders.encode(image, supplied)
        result = predictor.predict(features)
        result.update(diagnostics, text_source="supplied_text" if args.text_file else "dom_text",
                      screenshot_sha256=sha256(args.screenshot), head_sha256=sha256(args.head),
                      pretrained_overlap_verified=False)
        print(json.dumps(result, indent=2))
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        parser.exit(1, f"Inference failed: {error}\n")


if __name__ == "__main__":
    main()
