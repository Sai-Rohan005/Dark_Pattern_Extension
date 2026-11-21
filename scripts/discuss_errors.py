"""Append measured modality diagnostics and clearly marked interpretation."""
import argparse
import csv
import json
from pathlib import Path
import re

from transformers import PreTrainedTokenizerFast

from dpd.data.audit import sha256, write_csv


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", default="results")
    parser.add_argument("--analysis", default="results/error_analysis")
    parser.add_argument("--snapshot", required=True)
    args = parser.parse_args()
    results, analysis, snapshot = Path(args.results), Path(args.analysis), Path(args.snapshot)
    report = analysis / "report.md"
    if "## Why modalities help or fail" in report.read_text():
        raise ValueError("Discussion already exists; use a fresh analysis directory")
    metadata = json.loads((results / "provenance.json").read_text())
    text_path = Path(metadata["config"]["evaluation"]["text_manifest"])
    if sha256(text_path) != metadata["text_manifest_sha256"]:
        raise ValueError("OCR changed after scoring")
    features = metadata["features"]["provenance"]
    for name in ("modernbert/tokenizer.json", "modernbert/tokenizer_config.json"):
        if sha256(snapshot / name) != features["model_sha256"][name]:
            raise ValueError("Tokenizer differs from scored features")
    settings = json.loads((snapshot / "modernbert/tokenizer_config.json").read_text())
    settings.pop("tokenizer_class", None)
    settings["additional_special_tokens"] = settings.pop("extra_special_tokens", [])
    tokenizer = PreTrainedTokenizerFast(tokenizer_file=str(snapshot / "modernbert/tokenizer.json"), **settings)
    max_length = json.loads((snapshot / "config.json").read_text())["text"]["max_length"]
    texts = {r["file_name"]: r["text"] for r in json.loads(text_path.read_text())}
    errors = list(csv.DictReader((analysis / "confident_errors.csv").open()))
    profile = {r["variant"]: r for r in csv.DictReader((analysis / "modality_errors.csv").open())}
    # Lexical diagnostics are not pattern labels, predictions or semantic proof.
    cue_regex = re.compile(r"hurry|countdown|ends soon|code ends|items available|people are looking|viewed this|have taken this offer", re.I)
    diagnostics = []
    for row in errors:
        text = texts[row["file_name"]]
        full = tokenizer(text, truncation=False)
        kept = tokenizer(text, truncation=True, max_length=max_length, return_offsets_mapping=True)
        retained_end = max(end for _, end in kept["offset_mapping"])
        cues = list(cue_regex.finditer(text))
        diagnostics.append(dict(file_name=row["file_name"], error_type=row["error_type"],
                                token_count=len(full["input_ids"]), token_limit=max_length,
                                truncated=len(full["input_ids"]) > max_length,
                                present_cues="; ".join(m.group() for m in cues),
                                retained_cues="; ".join(m.group() for m in cues if m.end() <= retained_end)))
    write_csv(analysis / "text_diagnostics.csv", diagnostics)
    false_negatives = [r for r in errors if r["error_type"] == "FN"]
    missing_crop = sum(float(r["max_dp_box_crop_coverage"]) == 0 for r in false_negatives)
    retained_cue_errors = sum(r["error_type"] == "FN" and bool(r["retained_cues"]) for r in diagnostics)
    faithful = next(r for r in errors if r["file_name"] == "(723)www.faithful-to-nature.co.za_9b6f.jpg")
    lines = ["", "## Why modalities help or fail", "",
             "The following separates measured observations from hypotheses. Separate modality heads are not causal interventions on a single fusion model; attention is not evidence of deceptive intent.", "",
             f"**Visual.** Visual-only misses {float(profile['visual']['fn_mean']):g} positives on average. Among the {len(false_negatives)} mean-score full-fusion false negatives, {missing_crop} have all annotated DP boxes completely outside the encoder crop. The Victorian Plumbing countdowns sit to the right of the crop; Mirraw's timer is above it, and Droom's activity message is to its right. Those annotated pixels never reach DINOv2. This is a concrete preprocessing failure, though it does not establish how a different crop would change classification. Faithful to Nature's stock label is fully inside the crop and is still missed, so cropping alone cannot explain every error. Its rollout emphasizes product edges and controls more strongly than the small stock message; this is qualitative encoder attention, not a class attribution.", "",
             f"**Text.** Text-only has mean false negatives {float(profile['text']['fn_mean']):.3f} and false positives {float(profile['text']['fp_mean']):.3f}. OCR is not always the bottleneck: {retained_cue_errors} full-fusion false negatives retain at least one listed scarcity/activity cue within the actual token budget. The lexical checks and truncation status are in text_diagnostics.csv; they are not new ground-truth categories. The screenshots/OCR include stock counts, activity statements and countdown wording. A plausible limitation is that small-data training on raw OCR fails to learn when such text is manipulative, and the existing service uses a richer widget serialization. This hypothesis has not been isolated experimentally. Conversely, benign sale/free-trial wording on Houzz and Crossrope shows why keyword presence alone is insufficient.", "",
             f"**Graph.** Graph-only reduces mean false negatives to {float(profile['graph']['fn_mean']):.3f}, while mean false positives rise to {float(profile['graph']['fp_mean']):.3f}. On the Faithful to Nature miss, graph-only mean P(DP) is {float(faithful['graph_mean_probability']):.3f}, whereas full fusion is {float(faithful['probability']):.3f}. This supports a useful but nonspecific structural signal in this pilot. Graph nodes encode widget class/geometry/confidence, not stock-message meaning or whether a stated deadline is real. Detector errors and generic shopping-page structures are plausible causes of false alarms, not verified explanations for individual decisions.", "",
             "**Fusion and label limits.** Crossrope is a full-fusion false positive even though the mean score of each single-modality head is below threshold. Fusion learns a different decision function; it does not average those three probabilities. Combining modalities can suppress graph-only recoveries or reinforce weak correlations. Houzz and Crossrope remain false positives under the supplied NO DP labels; screenshot-only evidence cannot resolve every annotation-policy or interaction-dependent ambiguity. No labels were changed to improve metrics.", "",
             "Next experiments should preserve headers/right-hand banners with full-page or multi-scale visual inputs, retain text-to-widget associations, and validate detector/graph failures on manually checked examples. Any threshold or hyperparameter changes must use training/validation data, with a new held-out evaluation for confirmatory claims. These are proposed experiments, not measured improvements.", "",
             "### OCR budget checks for ranked errors", "",
             "| Screenshot | Tokens before truncation | Truncated | Diagnostic cues retained |", "| --- | ---: | --- | --- |"]
    for row in diagnostics:
        lines.append(f"| {row['file_name']} | {row['token_count']} | {row['truncated']} | {row['retained_cues'] or '—'} |")
    report.write_text(report.read_text() + "\n".join(lines) + "\n")
    provenance = dict(script_sha256=sha256(__file__), source_results_sha256=sha256(results / "provenance.json"),
                      source_error_csv_sha256=sha256(analysis / "confident_errors.csv"),
                      text_diagnostics_sha256=sha256(analysis / "text_diagnostics.csv"),
                      false_negatives_with_all_dp_boxes_outside_crop=missing_crop,
                      false_negatives_with_retained_lexical_cues=retained_cue_errors,
                      attention_interpretation="Qualitative inspection; not a causal or class-specific attribution")
    (analysis / "discussion_provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(json.dumps(provenance, indent=2))
