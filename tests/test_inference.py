from pathlib import Path

import numpy as np
import pytest
from sklearn.preprocessing import StandardScaler
import torch

from dpd.inference import FusionPredictor, text_from_dom
from dpd.models.fusion import FeatureFusion


def test_dom_fixture_text_omits_metadata_and_hidden_content():
    source = (Path(__file__).parent / "fixtures/page.html").read_text()
    assert text_from_dom(source) == "Offer ends soon Accept Decline Details"


def test_dom_nested_hidden_and_void_elements():
    assert text_from_dom('<main>Offer<br>ends &amp; soon<span aria-hidden="true"><b>secret</b></span><input><p>Details</p></main>') == "Offer ends & soon Details"


@pytest.fixture
def inference_bundle(tmp_path):
    torch.manual_seed(0)
    dimensions = {"visual": 4, "text": 6, "graph": 3}
    features = {name: np.linspace(0, 1, size, dtype=np.float32) for name, size in dimensions.items()}
    scalers = {name: StandardScaler().fit(np.stack([value - 2, value, value + 1])) for name, value in features.items()}
    model = FeatureFusion(dimensions, tuple(dimensions), 8, 0).eval()
    bundle = dict(format_version=1, verified_against_saved_predictions=True, dimensions=dimensions,
                  modalities=list(dimensions), projection_dim=8, dropout=0,
                  state_dict=model.state_dict(), threshold=.5, seed=0,
                  normalization={name: {"mean": torch.tensor(s.mean_), "scale": torch.tensor(s.scale_)} for name, s in scalers.items()})
    path = tmp_path / "test-head.pt"
    torch.save(bundle, path)
    return path, features, scalers, model


def test_inference_restores_training_normalization_and_confidence(inference_bundle):
    path, features, scalers, model = inference_bundle
    predictor = FusionPredictor(path)
    actual = predictor.predict(features)
    normalized = {name: torch.tensor(scalers[name].transform(values[None])) for name, values in features.items()}
    with torch.no_grad():
        expected = float(torch.sigmoid(model(normalized))[0])
    assert actual["probability_dark_pattern"] == pytest.approx(expected, abs=1e-7)
    assert actual["prediction"] == int(expected >= .5)
    assert actual["confidence"] == pytest.approx(expected if expected >= .5 else 1 - expected)
    assert actual["confidence_calibrated"] is False


@pytest.mark.parametrize("bad", [np.array([np.nan] * 4), np.ones(5)])
def test_inference_rejects_invalid_features(inference_bundle, bad):
    path, features, _, _ = inference_bundle
    features["visual"] = bad
    with pytest.raises(ValueError):
        FusionPredictor(path).predict(features)


def test_unverified_head_is_rejected(inference_bundle):
    path, _, _, _ = inference_bundle
    bundle = torch.load(path, weights_only=True)
    bundle["verified_against_saved_predictions"] = False
    torch.save(bundle, path)
    with pytest.raises(ValueError, match="verified"):
        FusionPredictor(path)
