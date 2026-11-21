"""Verify experiment setup without model downloads or a dataset."""
import json
import os
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import unittest

import numpy as np
import torch
import yaml

from dpd.cli import load_config
from dpd.reproducibility import seed_everything, seed_worker

ROOT = Path(__file__).resolve().parents[1]


class ResearchSetupTests(unittest.TestCase):
    def test_reseeding_repeats_all_available_rngs(self):
        def sample():
            generator = seed_everything(42)
            values = [random.random(), np.random.rand(), torch.rand(4),
                      torch.randperm(8, generator=generator)]
            if torch.cuda.is_available():
                values.append(torch.rand(4, device="cuda").cpu())
            return values

        first, second = sample(), sample()
        self.assertEqual(first[:2], second[:2])
        for left, right in zip(first[2:], second[2:]):
            self.assertTrue(torch.equal(left, right))
        self.assertTrue(torch.are_deterministic_algorithms_enabled())

    def test_worker_seed_repeats_python_and_numpy(self):
        seed_everything(42)
        seed_worker(0)
        first = (random.random(), np.random.rand())
        seed_worker(0)
        self.assertEqual(first, (random.random(), np.random.rand()))

    def test_invalid_seed_is_rejected(self):
        config = load_config(ROOT / "configs/default.yaml")
        for seed in (True, -1, 2**32, "42"):
            with self.subTest(seed=seed), tempfile.TemporaryDirectory() as temp:
                config["seed"] = seed
                path = Path(temp) / "config.yaml"
                path.write_text(yaml.safe_dump(config))
                with self.assertRaises(ValueError):
                    load_config(path)

    def test_cli_records_setup_and_never_claims_training(self):
        for script in ("train.py", "evaluate.py"):
            for dry_run in (True, False):
                with self.subTest(script=script, dry_run=dry_run):
                    with tempfile.TemporaryDirectory() as temp:
                        config = load_config(ROOT / "configs/default.yaml")
                        config["output_dir"] = str(Path(temp) / "runs")
                        path = Path(temp) / "config.yaml"
                        path.write_text(yaml.safe_dump(config))
                        env = dict(os.environ, PYTHONPATH=str(ROOT / "src"),
                                   PYTHONHASHSEED="0", CUBLAS_WORKSPACE_CONFIG=":4096:8")
                        args = [sys.executable, str(ROOT / "scripts" / script),
                                "--config", str(path)]
                        if dry_run:
                            args.append("--dry-run")
                        result = subprocess.run(args, env=env, cwd=ROOT,
                                                capture_output=True, text=True)
                        self.assertEqual(result.returncode, 0 if dry_run else 1,
                                         result.stdout + result.stderr)
                        record_path, = Path(config["output_dir"]).glob("*/environment.json")
                        record = json.loads(record_path.read_text())
                        self.assertEqual(record["status"],
                                         "setup_only" if dry_run else "not_implemented")
                        self.assertIn("torch", record["environment"]["packages"])
                        self.assertEqual(record["environment"]["python_hash_seed"], "0")
                        saved_config = yaml.safe_load(record_path.with_name("config.yaml").read_text())
                        self.assertEqual(saved_config, config)
                        self.assertNotIn("metrics", record)
                        if not dry_run:
                            self.assertIn("not implemented", result.stderr)


if __name__ == "__main__":
    unittest.main()
