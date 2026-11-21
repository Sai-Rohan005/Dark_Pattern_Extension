# Dataset audit: local AIDUI / ContextDP derivative

## Scope and evidence

This describes data actually read from
`/Users/rohittanuku/Downloads/major_project_dataset`. The classification input is
`merged_dataset/merged_annotations.json` with `merged_dataset/images/`, referenced
by `/Users/rohittanuku/Downloads/dark_pattern_detection_(2).ipynb`.

All local counts and split results below were computed by
[`scripts/audit_dataset.py`](../scripts/audit_dataset.py). The checked-in
[aggregate report](dataset_audit.json) records input hashes, dependency versions,
split statistics and manifest hashes. Full manifests and screenshots remain
outside version control. These are data audit results, not model metrics.

## Source and license

The source directories are `AidUi_evaluation/mobile/` and
`AidUi_evaluation/web/`, each containing `images/` and `bounding-boxes.json`.
The local merge script `p.py` copies mobile images followed by web images,
renumbers IDs and combines binary annotations. The audit verified every merged
image against its source by SHA-256 and every binary annotation against the
original category and bounding box. `merged_multi_class/` is another derivative,
not an independent dataset to combine with this one. The nearby AGM repository
is not counted as additional classification samples.

The upstream artifact is [SageSELab/AidUI](https://github.com/SageSELab/AidUI),
with an [archived replication package](https://zenodo.org/records/7644939).
The [paper's dataset section](https://arxiv.org/html/2303.06782#S4.SS1) describes
mobile frames from app usage videos and RICO, and web screenshots from shopping
sites and prior dark-pattern collections. This identifies likely upstream
lineage; no upstream commit or archive checksum accompanies this local copy.
Individual screenshots cannot all be traced to their original collection.

The upstream [LICENSE](https://github.com/SageSELab/AidUI/blob/master/LICENSE)
contains MIT-style permission for software and associated documentation. The
local annotation JSONs have no `licenses` field, and no screenshot-specific
license was found in the local AIDUI directories. An explicit license for the
local screenshot collection and modifications is **unverified**. Do not label
the screenshot dataset definitively MIT-licensed on this evidence.

## Samples and class balance

The classification unit is a screenshot. It is positive if **any** annotation
has category `DARK PATTERN`, and negative only when all annotations are `NO DP`.
Missing annotations are an error, not a negative. This matches the selected
notebook's screenshot label rule.

| Platform | Screenshot records | Positive | Negative |
| --- | ---: | ---: | ---: |
| Mobile | 339 | 175 | 164 |
| Web | 162 | 83 | 79 |
| Total | 501 | 258 | 243 |

There are 546 bounding-box annotations: 303 positive and 243 `NO DP`.
Annotation instances must not be reported as screenshot counts. The audit
completed without missing/unreadable images or source-image byte mismatches and
found no out-of-bounds or nonpositive-size boxes. This does not establish that
semantic labels or box boundaries are correct.

The total includes two pairs of identical files, also identical after RGB
decoding. `1405.jpg` / `1410.jpg` is a negative pair. The positive pair is
`music_13--Free-Music-Download-1-28_bf77.jpg` /
`music_19--Free-Music-Downloader-1-28_4797.jpg`.

## Annotation method

The original COCO-style JSONs contain image dimensions, IDs, categories and
pixel bounding boxes as left, top, width, height. Metadata names Label Studio
as contributor. Categories across the exports include default choice, nagging,
disguised ads, gamification, attention distraction, activity message, countdown
timer, limited-time message, low-stock message, high-demand message and `NO DP`.

The [upstream paper](https://arxiv.org/html/2303.06782#S4.SS1) describes manual
category and box labeling with agreed guidelines, independent labeling and
conflict resolution in Label Studio. The local files have no annotator
identities, per-annotator decisions or adjudication history, so this procedure
cannot be verified for this copy. The binary conversion script was not found;
its resulting labels and boxes were verified against the original JSONs. The
merge script does not perform annotation.

## UI graph construction

Annotation boxes identify DP regions; they are **not graph nodes**. The inspected
inference code builds nodes from YOLO-predicted widgets. These are inferred
spatial structures, not DOM trees or verified accessibility hierarchies.
Ground-truth DP labels must not enter graph construction at inference time.

The available `/Users/rohittanuku/Downloads/graph_schema.json` matches
`build_ui_graph` in the sibling project notebook
`Dark_pattern_ALL/Dark_pattern_detection/Dark_pattern_infernce 3.ipynb`:

- Detection boxes are normalized, clipped, and invalid or tiny boxes rejected.
  Nodes combine class one-hot vectors with normalized center, width, height,
  area and detector confidence. The schema has 20 widget classes and 26 node
  features.
- Relations cover containment/inside, boundary and center alignment, same
  row/column, overlap, reading order, controlled proximity and connectivity
  fallback. Symmetric relations add both directions. Reading order clusters
  rows top to bottom and sorts widgets left to right. Proximity requires an
  alignment or row/column signal; fallback bridges disconnected components.
- Edges have 14 relation flags plus normalized center distance and angle sine
  and cosine, giving 17 features. Thresholds come from the saved graph config,
  preserved exactly in the aggregate report.
- Empty detections produce an empty graph; the inspected feature pipeline can
  replace empty/failed graphs with zero features.

**Local graph variants are incompatible.** The selected training notebook
instead defines categorical widget embeddings, seven continuous geometry and
confidence values, and eleven edge features including nearest-neighbor
relations. It expects a different saved schema at runtime. The available schema
must not be assumed to match that training notebook or a deployed checkpoint.
No checkpoint/schema pairing, graph cache or dataset-wide graph generation was
validated during the dataset audit. The subsequent ablation feature extractor
uses the user-supplied deployed repository, checks the graph schema against
the GAT checkpoint, and requires a strict state-dictionary match. See the
[evaluation protocol](evaluation.md). This validates that selected pairing,
not the incompatible historical training-notebook variant.

## Saved split manifest and leakage

The supplied `/Users/rohittanuku/Downloads/dataset_splits.csv` records actual
saved membership with columns `sample_id,image_path,label,split`. The audit
matched all 501 rows to the local corpus by unique basename, checked labels
against annotations, required full coverage, and rejected duplicate filenames
or sample IDs. Colab path prefixes were relocated; no image was matched by row
position or guessed app identity. The notebook's `create_stratified_splits` uses two
`train_test_split` calls, stratified by screenshot label, with seed 42 and
target train/validation/test ratios 0.70/0.15/0.15. It checks distinct image
paths, without grouping sites/apps or comparing content.

The subsequently supplied `/Users/rohittanuku/Downloads/environment.json`
records the same seed and split ratios, but contains runtime versions and
configuration only, not sample identities or split membership. Its configured
output directory points to the expected historical manifest at
`/content/drive/MyDrive/Dark_pattern_Detection_4/output/dataset/dataset_splits.csv`.
That location was inferred from the configuration and notebook code; the
subsequently supplied local CSV is the manifest actually inspected here.

The audit also reconstructed that algorithm on current local data in merged
JSON order. Every saved assignment matches the reconstruction. The leakage
findings below are therefore confirmed directly in the supplied manifest,
rather than inferred only from notebook code. No checkpoint was linked to the
manifest, so its use in a particular training run remains unverified.

| Saved split | Screenshots | Positive | Negative |
| --- | ---: | ---: | ---: |
| Train | 350 | 180 | 170 |
| Validation | 75 | 39 | 36 |
| Test | 76 | 39 | 37 |

Six identifiable sites cross splits: `crossrope.com`, `harveynorman.com.sg`,
`naturehills.com`, `nutrabay.com`, `roamans.com`, and `shapermint.com`.
Shapermint spans all splits. The identical positive mobile pair also crosses
train/test. This protocol cannot support claims about unseen sites or apps.
Mobile app overlap remains unknown because the saved manifest also lacks app
IDs. Having split membership does not establish which screenshots share an app.

## Corrected splits and missing identities

New grouped manifests were written under `runs/dataset-audit-saved-manifest/`, leaving source
data untouched. Web filename domains are normalized to registrable domains
using the bundled offline public-suffix list, including private suffixes.
Subdomains and capture suffixes do not create new groups. This identifies 138
site groups covering 155 web screenshots. Filename-derived identities still
need review.

Groups sharing decoded-identical images are joined before splitting. Two
`GroupShuffleSplit` calls use seed 42 and the notebook's target proportions.
Proportions apply to groups, so screenshot counts and class balance can deviate;
the protocol does not promise class stratification.

| New grouped web split | Screenshots | Positive | Negative |
| --- | ---: | ---: | ---: |
| Train | 108 | 50 | 58 |
| Validation | 24 | 16 | 8 |
| Test | 23 | 10 | 13 |

The new manifests pass assertions for disjoint sample IDs, site groups, file
hashes and decoded pixel hashes, with both labels in every split. This means
no detected site or exact-image overlap **within this eligible web subset**.

The other 346 screenshots are excluded and recorded in `unresolved.csv`: all
339 mobile screenshots and seven web screenshots without reliable site names.
Their labels are 182 positive and 164 negative. App names must not be guessed
from filenames; numeric screenshot IDs must not be treated as distinct apps.

**A full web-and-mobile site/app-safe split is incomplete.** Supply a reviewed
CSV with `file_name,group_id`, using stable `app:package.name` or
`site:registrable.domain` identities, then rerun with `--identity-map`. Remaining
unknown records stay excluded and reported. Resolve all identities before
claiming a full-corpus split. The default training config remains unconfigured;
these partial manifests are not silently selected for full-dataset training.

## Reproduce

Install the pinned requirements. From the repo root, use a fresh output
directory per run; an existing directory is refused:

```sh
PYTHONPATH=src python scripts/audit_dataset.py \
  --dataset-root /Users/rohittanuku/Downloads/major_project_dataset \
  --notebook '/Users/rohittanuku/Downloads/dark_pattern_detection_(2).ipynb' \
  --graph-schema /Users/rohittanuku/Downloads/graph_schema.json \
  --saved-manifest /Users/rohittanuku/Downloads/dataset_splits.csv \
  --output runs/dataset-audit-saved-manifest
make test
```

Outputs are `summary.json`, `train.csv`, `val.csv`, `test.csv`,
`reconstructed_image_split.csv`, `historical_split.csv` and `unresolved.csv`.
The historical and reconstructed splits are diagnostic evidence, not corrected
training protocols. Generated manifests
stay ignored; the aggregate report supports review.

## Limitations

- This was an evaluation corpus. Training fusion layers on it changes the
  experimental protocol; the whole corpus can no longer be called an untouched
  external test set.
- The grouped subset is small and web-only, with different label proportions
  across splits. It cannot establish mobile performance.
- Missing app/source metadata prevents a full leakage audit. Domain grouping
  misses common owners, cross-domain templates and related apps.
- Byte/RGB equality misses resized, cropped or visually similar screenshots.
  Near-duplicate and upstream RICO encoder-pretraining overlap are unassessed.
- Category collapse hides pattern types and mixed regions. `NO DP` is an
  inherited label, not proof that deceptive behavior is absent.
- Screenshots omit interaction, timing and account state. Language and
  collection-date coverage were not measured; live sites may have changed.
- OCR/widget errors can distort modalities. Historical code can silently use
  zero features; the new evaluation extractor fails on extraction errors and
  records empty graphs using the checkpoint's learned empty embedding.
  Historical graph variants remain unreconciled.
- Download provenance, screenshot licensing and local annotation adjudication
  remain incomplete. No performance metric is claimed.
