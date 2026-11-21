"""Check error ordering, pattern slice denominators and attention rollout."""
import unittest

import numpy as np
import torch

from dpd.evaluation.attention import attention_rollout
from dpd.evaluation.error_analysis import bbox_coverage, crop_geometry, pattern_slice, rank_errors


class ErrorAnalysisTests(unittest.TestCase):
    def test_unique_confident_errors_are_not_padded(self):
        rows = [dict(file_name="a", label=0), dict(file_name="b", label=0),
                dict(file_name="c", label=1), dict(file_name="d", label=1)]
        errors = rank_errors(rows, [.7, .9, .1, .8], limit=20)
        self.assertEqual([r["file_name"] for r in errors], ["b", "a", "c"])
        self.assertEqual([r["rank"] for r in errors], [1, 2, 1])
        self.assertEqual(len(rank_errors(rows, [.7, .9, .1, .8], limit=1)), 2)
        self.assertAlmostEqual(errors[2]["wrong_class_confidence"], .9)

    def test_other_pattern_positives_are_not_benign_controls(self):
        rows = [dict(file_name="a", label=1), dict(file_name="b", label=1),
                dict(file_name="mixed", label=1), dict(file_name="negative", label=0)]
        annotations = {"a": {"A"}, "b": {"B"}, "mixed": {"A", "B"}, "negative": set()}
        self.assertEqual(pattern_slice(rows, annotations, "A").tolist(), [True, False, True, True])
        self.assertEqual(pattern_slice(rows, annotations, "absent").tolist(), [False, False, False, True])

    def test_crop_and_box_overlap(self):
        crop = crop_geometry(1024, 512)
        self.assertTrue(0 < crop[0] < crop[2] < 1024)
        self.assertEqual(bbox_coverage([0, 0, 10, 10], crop), 0)
        self.assertEqual(bbox_coverage([crop[0], crop[1], 10, 10], crop), 1)

    def test_rollout_is_finite_normalized_patch_mass(self):
        uniform = torch.full((1, 2, 5, 5), .2)
        rollout = attention_rollout([uniform, uniform])
        self.assertEqual(rollout.shape, (2, 2))
        np.testing.assert_allclose(rollout, .25, atol=1e-7)
        self.assertAlmostEqual(float(rollout.sum()), 1)
        with self.assertRaises(ValueError):
            attention_rollout([])


if __name__ == "__main__":
    unittest.main()
