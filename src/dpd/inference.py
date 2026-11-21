"""Single-screenshot inference using a verified exported fusion head."""
from html.parser import HTMLParser
from pathlib import Path

import numpy as np
import torch

from dpd.models.fusion import FeatureFusion


class DOMTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.stack = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        suppressed = (tag in {"script", "style", "head", "noscript", "template"} or "hidden" in attrs
                      or attrs.get("aria-hidden", "").lower() == "true")
        hidden = suppressed or (self.stack[-1][1] if self.stack else False)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append((tag, hidden))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if not self.stack or not self.stack[-1][1]:
            self.parts.append(data)


def text_from_dom(html):
    parser = DOMTextParser()
    parser.feed(html)
    parser.close()
    return " ".join(" ".join(parser.parts).split())


class FusionPredictor:
    def __init__(self, checkpoint):
        bundle = torch.load(Path(checkpoint), map_location="cpu", weights_only=True)
        if bundle.get("format_version") != 1 or not bundle.get("verified_against_saved_predictions"):
            raise ValueError("Use a verified checkpoint produced by export_head.py")
        self.bundle = bundle
        self.model = FeatureFusion(bundle["dimensions"], bundle["modalities"],
                                   bundle["projection_dim"], bundle["dropout"])
        self.model.load_state_dict(bundle["state_dict"], strict=True)
        self.model.eval()
        self.threshold = float(bundle["threshold"])
        if not 0 < self.threshold < 1:
            raise ValueError("Invalid checkpoint threshold")

    @torch.inference_mode()
    def predict(self, features):
        normalized = {}
        for name, dimension in self.bundle["dimensions"].items():
            values = np.asarray(features[name], dtype=np.float32).copy()
            if values.shape != (dimension,) or not np.isfinite(values).all():
                raise ValueError(f"Expected finite {name} vector of length {dimension}")
            stats = self.bundle["normalization"][name]
            mean, scale = stats["mean"].numpy(), stats["scale"].numpy()
            if mean.shape != values.shape or scale.shape != values.shape or not np.isfinite(mean).all() or not np.isfinite(scale).all() or (scale <= 0).any():
                raise ValueError("Invalid saved training normalization")
            # Match StandardScaler's float32 in-place subtraction/division.
            values -= mean
            values /= scale
            normalized[name] = torch.tensor(values).unsqueeze(0)
        logit = self.model(normalized)
        if not torch.isfinite(logit).all():
            raise ValueError("Fusion head returned a nonfinite score")
        probability = float(torch.sigmoid(logit)[0])
        prediction = int(probability >= self.threshold)
        return {"prediction": prediction, "label": "dark_pattern" if prediction else "no_dark_pattern",
                "probability_dark_pattern": probability,
                "confidence": probability if prediction else 1 - probability,
                "confidence_calibrated": False, "threshold": self.threshold,
                "seed": self.bundle["seed"]}
