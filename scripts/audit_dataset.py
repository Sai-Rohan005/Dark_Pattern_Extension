"""Audit local AIDUI data; usage is documented in docs/dataset.md."""
import argparse
import json

from dpd.data.audit import audit


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset-root", required=True)
    parser.add_argument("--notebook", required=True)
    parser.add_argument("--graph-schema", required=True)
    parser.add_argument("--output", required=True, help="New output directory; existing directories are refused")
    parser.add_argument("--identity-map", help="Reviewed CSV: file_name,group_id (site:domain or app:package)")
    parser.add_argument("--saved-manifest", help="Existing CSV with sample_id,image_path,label,split")
    args = parser.parse_args()
    summary = audit(args.dataset_root, args.notebook, args.graph_schema, args.output,
                    args.identity_map, args.saved_manifest)
    if "saved_manifest" in summary:
        print(json.dumps({"saved_manifest": summary["saved_manifest"]}, indent=2))
    print(json.dumps({key: summary[key] for key in (
        "status", "total", "by_platform", "annotation_count", "invalid_bbox_count",
        "exact_file_duplicate_groups", "decoded_pixel_duplicate_groups",
        "reconstructed_notebook_split", "grouped_split",
    )}, indent=2))
