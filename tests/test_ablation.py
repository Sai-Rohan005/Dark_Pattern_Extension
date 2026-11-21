"""Synthetic fixtures check protocol behavior, not research performance."""
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image

from dpd.data.audit import sha256, write_csv
from dpd.evaluation.ablation import load_splits, run_ablation
from dpd.evaluation.metrics import binary_metrics


class AblationTests(unittest.TestCase):
    def test_metrics_and_confusion_orientation(self):
        result = binary_metrics([0, 0, 1, 1], [.1, .8, .3, .9], .5)
        for metric in ("accuracy", "precision", "recall", "f1"):
            self.assertEqual(result[metric], .5)
        self.assertEqual([result[k] for k in ("tn", "fp", "fn", "tp")], [1, 1, 1, 1])
        self.assertAlmostEqual(result["roc_auc"], .75)
        self.assertAlmostEqual(result["pr_auc"], 19 / 24)
        with self.assertRaises(ValueError):
            binary_metrics([1, 1], [.5, .9], .5)

    def test_at_least_three_distinct_seeds(self):
        for seeds in ([42, 43], [42, 42, 43]):
            with self.subTest(seeds=seeds), self.assertRaises(ValueError):
                run_ablation({"evaluation": {"seeds": seeds}})

    def test_full_protocol_and_leakage_guard(self):
        import csv
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data, texts, features = {}, [], []
            rng = np.random.default_rng(0)
            for split_number, split in enumerate(("train", "val", "test")):
                rows = []
                for i in range(8):
                    identity = f"{split}-{i}"
                    image = root / (identity + ".png")
                    Image.new("RGB", (2, 2), (i * 20, split_number * 50, 1)).save(image)
                    digest = sha256(image)
                    label = i % 2
                    rows.append(dict(sample_id=identity, file_name=image.name, image_path=str(image),
                                     label=label, split=split, group_id=f"site:{split}-{i // 2}",
                                     file_sha256=digest, pixel_sha256=digest))
                    texts.append(dict(file_name=image.name, text="benign clear" if not label else "deceptive urgency",
                                      image_sha256=digest))
                    path = root / (identity + ".npz")
                    np.savez(path, **{f"{m}_feature": rng.normal(size=4).astype(np.float32)
                                     for m in ("visual", "text", "graph")})
                    features.append(dict(file_name=image.name, feature_path=str(path),
                                         image_sha256=digest, feature_sha256=sha256(path)))
                path = root / (split + ".csv")
                write_csv(path, rows)
                data[split + "_manifest"] = str(path)
            cache = root / "features"
            cache.mkdir()
            write_csv(cache / "manifest.csv", features)
            (cache / "provenance.json").write_text(json.dumps({"encoders": "synthetic fixture"}))
            ocr = root / "ocr"
            ocr.mkdir()
            (ocr / "text.json").write_text(json.dumps(texts))
            (ocr / "provenance.json").write_text(json.dumps({"text_sha256": sha256(ocr / "text.json")}))
            config = dict(deterministic=True, model=dict(projection_dim=4, dropout=.1),
                          training=dict(epochs=2, batch_size=4, learning_rate=.001, weight_decay=.01), data=data,
                          evaluation=dict(seeds=[42, 43, 44], threshold=.5, num_threads=1,
                                          dataset_scope="Synthetic unit-test fixture; not research data",
                                          results_dir=str(root / "results"), feature_manifest=str(cache / "manifest.csv"),
                                          text_manifest=str(ocr / "text.json"), tfidf_max_features=100, logistic_c=1.0))
            self.assertTrue(run_ablation(config))
            with (root / "results/ablation.csv").open() as handle:
                report = list(csv.DictReader(handle))
            self.assertEqual(len(report), 8)
            self.assertTrue(all(r["status"] == "completed" and r["n_seeds"] == "3" for r in report))
            for row in report:
                self.assertAlmostEqual(sum(float(row[k + "_mean"]) for k in ("tn", "fp", "fn", "tp")), 8)
            record = json.loads((root / "results/provenance.json").read_text())
            predictions = list((root / "results/predictions").glob("*.csv"))
            self.assertEqual(len(predictions), 24)
            for path in predictions:
                with path.open() as handle:
                    self.assertEqual([r["sample_id"] for r in csv.DictReader(handle)], record["test_order"])
            # Missing features must never turn into zero or fabricated scores.
            config["evaluation"]["feature_manifest"] = None
            config["evaluation"]["results_dir"] = str(root / "blocked-results")
            self.assertFalse(run_ablation(config))
            with (root / "blocked-results/ablation.csv").open() as handle:
                blocked = list(csv.DictReader(handle))
            self.assertTrue(all(r["status"] == "blocked" and r["accuracy_mean"] == "" for r in blocked[:-1]))
            self.assertEqual(blocked[-1]["status"], "completed")
            # A site spanning train/test must stop the whole protocol.
            with Path(data["test_manifest"]).open() as handle:
                rows = list(csv.DictReader(handle))
            rows[0]["group_id"] = "site:train-0"
            write_csv(data["test_manifest"], rows)
            with self.assertRaises(ValueError):
                load_splits(config)


if __name__ == "__main__":
    unittest.main()
