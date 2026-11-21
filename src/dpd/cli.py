"""Shared setup for the train/evaluation scaffolds."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import tempfile

import yaml

from dpd.reproducibility import environment_versions, seed_everything


def load_config(path):
    config = yaml.safe_load(Path(path).read_text())
    if not isinstance(config, dict):
        raise ValueError("Config must be a YAML mapping")
    seed = config.get("seed")
    if type(seed) is not int or not 0 <= seed < 2**32:
        raise ValueError("seed must be an unsigned integer supported by NumPy")
    if type(config.get("deterministic")) is not bool:
        raise ValueError("deterministic must be a boolean")
    if not isinstance(config.get("output_dir"), str) or not config["output_dir"].strip():
        raise ValueError("output_dir must be a nonempty path")
    for section in ("model", "training", "data", "evaluation"):
        if not isinstance(config.get(section), dict):
            raise ValueError(f"{section} must be a mapping")
    return config


def main(mode):
    parser = argparse.ArgumentParser(description=f"{mode} research scaffold")
    parser.add_argument("--config", default="configs/default.yaml")
    parser.add_argument("--dry-run", action="store_true", help="Validate setup and log provenance only")
    args = parser.parse_args()
    try:
        config = load_config(args.config)
        seed_everything(config["seed"], config["deterministic"])
        versions = environment_versions()
    except (ValueError, OSError, ImportError, yaml.YAMLError) as error:
        parser.exit(1, f"Setup failed: {error}\nInstall requirements.txt and check the YAML config.\n")
    output = Path(config["output_dir"])
    output.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run_dir = Path(tempfile.mkdtemp(prefix=f"{mode}-{timestamp}-", dir=output))
    resolved = yaml.safe_dump(config, sort_keys=True)
    (run_dir / "config.yaml").write_text(resolved)
    record = {
        "mode": mode,
        "status": "setup_only" if args.dry_run else "not_implemented",
        "config_sha256": hashlib.sha256(resolved.encode()).hexdigest(),
        "environment": versions,
    }
    (run_dir / "environment.json").write_text(json.dumps(record, indent=2) + "\n")
    print(f"Saved configuration and environment to {run_dir}")
    if not args.dry_run:
        parser.exit(1, f"{mode} is not implemented: connect the dataset, model and loop. No metrics were computed.\n")
    print("Setup validated. No training or evaluation was performed.")
