"""Audit the local AIDUI derivative and create conservative grouped splits.

No notebook code is executed. Unknown site/app identities are quarantined.
"""
import ast
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path
import re

import numpy as np
from PIL import Image
from sklearn.model_selection import GroupShuffleSplit, train_test_split
import tldextract

SPLITS = ("train", "val", "test")


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def site_from_filename(name, extractor):
    # Handles domain.png, (index)www.domain_hash.jpg, and subdomains.
    stem = Path(name).stem.lower()
    match = re.search(r"(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}", stem)
    if not match:
        return None
    parts = extractor(match.group())
    if not parts.suffix or not parts.domain:
        return None
    return "site:" + parts.registered_domain


def class_counts(rows):
    counts = Counter(str(row["label"]) for row in rows)
    return {"samples": len(rows), "negative": counts["0"], "positive": counts["1"]}


def overlap(rows, key):
    memberships = defaultdict(set)
    for row in rows:
        if row.get(key):
            memberships[row[key]].add(row["split"])
    return {value: sorted(splits) for value, splits in sorted(memberships.items())
            if len(splits) > 1}


def grouped_splits(rows, seed, ratios):
    """Keep site/app groups and decoded-identical images in the same split."""
    rows = [dict(row) for row in rows]
    parent = {row["group_id"]: row["group_id"] for row in rows}

    def find(group):
        while parent[group] != group:
            parent[group] = parent[parent[group]]
            group = parent[group]
        return group

    hashes = {}
    for row in rows:
        digest, group = row["pixel_sha256"], row["group_id"]
        if digest in hashes:
            a, b = sorted((find(group), find(hashes[digest])))
            parent[b] = a
        hashes[digest] = group
    for row in rows:
        row["split_group"] = find(row["group_id"])
    groups = [row["split_group"] for row in rows]
    if len(set(groups)) < 3:
        raise ValueError("Need at least three independent known groups for train/val/test")
    indices = np.arange(len(rows))
    train, temp = next(GroupShuffleSplit(
        n_splits=1, train_size=ratios[0], random_state=seed,
    ).split(indices, groups=groups))
    val, test = next(GroupShuffleSplit(
        n_splits=1, train_size=ratios[1] / (ratios[1] + ratios[2]), random_state=seed,
    ).split(temp, groups=[groups[i] for i in temp]))
    for name, selected in zip(SPLITS, (train, temp[val], temp[test])):
        for i in selected:
            rows[int(i)]["split"] = name
    for key in ("sample_id", "group_id", "split_group", "file_sha256", "pixel_sha256"):
        if overlap(rows, key):
            raise ValueError(f"Cross-split leakage remains for {key}")
    for name in SPLITS:
        if len({row["label"] for row in rows if row["split"] == name}) != 2:
            raise ValueError(f"{name} lacks a class; choose a reviewed grouped protocol")
    return rows


def notebook_protocol(path):
    notebook = json.loads(Path(path).read_text())
    settings = {}
    split_source = None
    for cell in notebook["cells"]:
        if cell["cell_type"] != "code":
            continue
        source = "".join(cell.get("source", []))
        try:
            tree = ast.parse(source)
        except SyntaxError:  # Notebook shell/magic cells are not Python modules.
            continue
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == "Config":
                for field in node.body:
                    if isinstance(field, ast.AnnAssign) and isinstance(field.target, ast.Name):
                        if field.target.id in ("SEED", "TRAIN_RATIO", "VAL_RATIO", "TEST_RATIO"):
                            settings[field.target.id] = ast.literal_eval(field.value)
            if isinstance(node, ast.FunctionDef) and node.name == "create_stratified_splits":
                split_source = ast.get_source_segment(source, node)
    if not split_source or "train_test_split" not in split_source or "stratify=" not in split_source:
        raise ValueError("Notebook does not contain the expected image-stratified protocol")
    if "groups=" in split_source:
        raise ValueError("Notebook protocol changed; review before reconstructing")
    return settings, split_source


def write_csv(path, rows):
    if not rows:
        return
    with Path(path).open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def match_saved_manifest(path, rows):
    """Join Colab paths to audited local files; reject ambiguous or partial input."""
    with Path(path).open(newline="") as handle:
        reader = csv.DictReader(handle)
        if not {"sample_id", "image_path", "label", "split"}.issubset(reader.fieldnames or []):
            raise ValueError("Saved manifest needs sample_id, image_path, label, split")
        saved = list(reader)
    by_name = {row["file_name"]: row for row in rows}
    if len(by_name) != len(rows):
        raise ValueError("Local filenames are ambiguous")
    matched, seen_names, seen_ids = [], set(), set()
    for entry in saved:
        name = Path(entry["image_path"]).name
        if name not in by_name or name in seen_names:
            raise ValueError(f"Unknown or duplicate saved filename: {name}")
        if not entry["sample_id"] or entry["sample_id"] in seen_ids:
            raise ValueError("Empty or duplicate saved sample ID")
        if entry["split"] not in SPLITS:
            raise ValueError(f"Unknown split: {entry['split']}")
        row = by_name[name]
        if entry["label"] != str(row["label"]):
            raise ValueError(f"Saved label disagrees with local annotations: {name}")
        matched.append(dict(row, split=entry["split"], historical_sample_id=entry["sample_id"]))
        seen_names.add(name)
        seen_ids.add(entry["sample_id"])
    if seen_names != set(by_name):
        raise ValueError("Saved manifest does not cover the full audited dataset")
    return matched


def audit(root, notebook, graph_schema, output, identity_map=None, saved_manifest=None):
    root, output = Path(root).resolve(), Path(output).resolve()
    # Prevent mixing a new audit with stale manifests from an earlier run.
    output.mkdir(parents=True, exist_ok=False)
    binary_path = root / "merged_dataset/merged_annotations.json"
    binary = json.loads(binary_path.read_text())
    categories = {c["id"]: c["name"] for c in binary["categories"]}
    if categories != {0: "NO DP", 1: "DARK PATTERN"}:
        raise ValueError("Unexpected binary category mapping; explicit review required")
    annotations = defaultdict(list)
    image_ids = {image["id"] for image in binary["images"]}
    if len(image_ids) != len(binary["images"]):
        raise ValueError("Duplicate image IDs")
    for ann in binary["annotations"]:
        if ann["image_id"] not in image_ids or ann["category_id"] not in categories:
            raise ValueError("Annotation references unknown image/category")
        annotations[ann["image_id"]].append(ann)

    originals, inputs = {}, [binary_path, Path(notebook), Path(graph_schema), root / "p.py"]
    original_annotations = Counter()
    for platform in ("mobile", "web"):
        source_path = root / f"AidUi_evaluation/{platform}/bounding-boxes.json"
        source = json.loads(source_path.read_text())
        inputs.append(source_path)
        names = {image["id"]: Path(image["file_name"]).name for image in source["images"]}
        cats = {cat["id"]: cat["name"] for cat in source["categories"]}
        for name in names.values():
            if name in originals:
                raise ValueError("Ambiguous original basename")
            originals[name] = platform
        for ann in source["annotations"]:
            key = (names[ann["image_id"]], tuple(ann["bbox"]), int(cats[ann["category_id"]] != "NO DP"))
            original_annotations[key] += 1

    explicit = {}
    if identity_map:
        inputs.append(Path(identity_map))
        with Path(identity_map).open(newline="") as handle:
            for entry in csv.DictReader(handle):
                name, group = entry["file_name"], entry["group_id"]
                if name in explicit or not group.startswith(("site:", "app:")):
                    raise ValueError("Identity mapping requires unique filenames and site:/app: groups")
                explicit[name] = group
        if set(explicit) - set(originals):
            raise ValueError("Identity mapping includes unknown filenames")
    extractor = tldextract.TLDExtract(
        suffix_list_urls=(), cache_dir=None, include_psl_private_domains=True,
    )
    rows, observed_annotations, invalid = [], Counter(), []
    for image in binary["images"]:
        name = Path(image["file_name"]).name
        if name not in originals:
            raise ValueError(f"No source provenance for {name}")
        anns = annotations[image["id"]]
        if not anns:
            raise ValueError(f"Missing label for {name}; do not assume negative")
        path = root / "merged_dataset/images" / name
        with Image.open(path) as im:
            im.load()
            if im.size != (image["width"], image["height"]):
                raise ValueError(f"Dimension mismatch for {name}")
            rgb = im.convert("RGB")
            pixel_hash = hashlib.sha256(str(rgb.size).encode() + rgb.tobytes()).hexdigest()
        original_path = root / f"AidUi_evaluation/{originals[name]}/images" / name
        file_hash = sha256(path)
        if file_hash != sha256(original_path):
            raise ValueError(f"Merged image differs from source: {name}")
        for ann in anns:
            observed_annotations[(name, tuple(ann["bbox"]), ann["category_id"])] += 1
            x, y, width, height = ann["bbox"]
            if min(x, y) < 0 or min(width, height) <= 0 or x + width > image["width"] or y + height > image["height"]:
                invalid.append(ann["id"])
        group = explicit.get(name)
        if not group and originals[name] == "web":
            group = site_from_filename(name, extractor)
        rows.append({
            "sample_id": str(image["id"]), "file_name": name, "image_path": str(path),
            "platform": originals[name], "label": int(any(a["category_id"] == 1 for a in anns)),
            "group_id": group or "", "group_evidence": "explicit_mapping" if name in explicit else
            ("filename_domain" if group else "unresolved"),
            "file_sha256": file_hash, "pixel_sha256": pixel_hash,
        })
    if observed_annotations != original_annotations:
        raise ValueError("Merged binary annotations differ from original label collapse")
    if len({row["file_name"] for row in rows}) != len(rows):
        raise ValueError("Duplicate filenames")
    settings, split_source = notebook_protocol(notebook)
    seed = settings["SEED"]
    ratios = [settings[key] for key in ("TRAIN_RATIO", "VAL_RATIO", "TEST_RATIO")]
    if not np.isclose(sum(ratios), 1) or any(r <= 0 for r in ratios):
        raise ValueError("Invalid split ratios")
    indices = np.arange(len(rows))
    labels = np.array([row["label"] for row in rows])
    train, temp = train_test_split(indices, train_size=ratios[0], stratify=labels, random_state=seed)
    val, test = train_test_split(temp, train_size=ratios[1] / (ratios[1] + ratios[2]),
                               stratify=labels[temp], random_state=seed)
    reconstructed = [dict(row) for row in rows]
    for name, selected in zip(SPLITS, (train, val, test)):
        for i in selected:
            reconstructed[int(i)]["split"] = name
    historical = None
    if saved_manifest:
        inputs.append(Path(saved_manifest))
        historical = match_saved_manifest(saved_manifest, rows)
        write_csv(output / "historical_split.csv", historical)
    known = [row for row in rows if row["group_id"]]
    unresolved = [row for row in rows if not row["group_id"]]
    grouped = grouped_splits(known, seed, ratios)
    for name in SPLITS:
        write_csv(output / f"{name}.csv", [row for row in grouped if row["split"] == name])
    write_csv(output / "unresolved.csv", unresolved)
    write_csv(output / "reconstructed_image_split.csv", reconstructed)
    schema = json.loads(Path(graph_schema).read_text())
    summary = {
        "status": "partial_identity_coverage" if unresolved else "all_identities_resolved",
        "dataset_root": str(root),
        "input_sha256": {str(path.resolve()): sha256(path) for path in inputs},
        "versions": {"numpy": np.__version__},
        "total": class_counts(rows),
        "by_platform": {p: class_counts([r for r in rows if r["platform"] == p]) for p in ("mobile", "web")},
        "annotation_categories": dict(Counter(categories[a["category_id"]] for a in binary["annotations"])),
        "annotation_count": len(binary["annotations"]),
        "invalid_bbox_count": len(invalid),
        "source_images_and_binary_collapse_verified": True,
        "exact_file_duplicate_groups": sum(v > 1 for v in Counter(r["file_sha256"] for r in rows).values()),
        "decoded_pixel_duplicate_groups": sum(v > 1 for v in Counter(r["pixel_sha256"] for r in rows).values()),
        "seed": seed, "target_ratios": ratios,
        "reconstructed_notebook_split": {
            "note": "Reconstruction of source algorithm on current local data, not a recovered historical manifest",
            "function_sha256": hashlib.sha256(split_source.encode()).hexdigest(),
            "counts": {s: class_counts([r for r in reconstructed if r["split"] == s]) for s in SPLITS},
            "known_site_app_overlap": overlap(reconstructed, "group_id"),
            "pixel_overlap": overlap(reconstructed, "pixel_sha256"),
        },
        "grouped_split": {
            "scope": "Known identities only; unresolved samples excluded and listed in unresolved.csv",
            "eligible": class_counts(known), "unresolved": class_counts(unresolved),
            "known_groups": len({r["group_id"] for r in known}),
            "counts": {s: class_counts([r for r in grouped if r["split"] == s]) for s in SPLITS},
            "site_app_overlap": overlap(grouped, "group_id"),
            "pixel_overlap": overlap(grouped, "pixel_sha256"),
        },
        "graph_schema": schema,
        "manifest_sha256": {p.name: sha256(p) for p in sorted(output.glob("*.csv"))},
    }
    if historical is not None:
        expected = {r["file_name"]: r["split"] for r in reconstructed}
        summary["saved_manifest"] = {
            "path": str(Path(saved_manifest).resolve()),
            "all_filenames_and_labels_match": True,
            "note": "Split membership is recorded in the supplied manifest; checkpoint use is unverified",
            "counts": {s: class_counts([r for r in historical if r["split"] == s]) for s in SPLITS},
            "assignment_differences_from_reconstruction": sum(r["split"] != expected[r["file_name"]] for r in historical),
            "known_site_app_overlap": overlap(historical, "group_id"),
            "file_overlap": overlap(historical, "file_sha256"),
            "pixel_overlap": overlap(historical, "pixel_sha256"),
            "unresolved_identities": sum(not r["group_id"] for r in historical),
        }
    from importlib.metadata import version
    for package in ("Pillow", "scikit-learn", "tldextract"):
        summary["versions"][package] = version(package)
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    return summary
