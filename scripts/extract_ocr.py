"""Extract on-device macOS Vision OCR for the fixed evaluation manifests."""
import argparse
import json
from pathlib import Path
import platform
import subprocess
import tempfile

import yaml

from dpd.data.audit import sha256
from dpd.evaluation.ablation import load_splits


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default="configs/ablation.yaml")
    args = parser.parse_args()
    config = yaml.safe_load(Path(args.config).read_text())
    rows, hashes = load_splits(config)
    target = Path(config["evaluation"]["text_manifest"])
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        raise ValueError("OCR output already exists; choose a fresh text_manifest")
    source = Path(__file__).with_name("ocr_macos.swift")
    with tempfile.TemporaryDirectory() as temp:
        temp = Path(temp)
        binary, input_path = temp / "ocr", temp / "input.json"
        subprocess.run(["swiftc", "-module-cache-path", str(temp / "modules"), str(source), "-o", str(binary)], check=True)
        input_path.write_text(json.dumps([{k: row[k] for k in ("file_name", "image_path")} for row in rows]))
        subprocess.run([str(binary), str(input_path), str(target)], check=True)
    texts = json.loads(target.read_text())
    by_name = {r["file_name"]: r for r in rows}
    for entry in texts:
        entry["image_sha256"] = by_name[entry["file_name"]]["file_sha256"]
    target.write_text(json.dumps(texts, indent=2) + "\n")
    metadata = {"engine": "macOS Vision VNRecognizeTextRequest", "recognition_level": "accurate",
                "languages": ["en-US"], "language_correction": True, "platform": platform.platform(),
                "script_sha256": sha256(source), "split_sha256": hashes,
                "text_sha256": sha256(target), "samples": len(texts),
                "empty_text_samples": sum(not r["text"].strip() for r in texts)}
    target.with_name("provenance.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))
