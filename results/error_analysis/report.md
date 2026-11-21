# Held-out error analysis

Scope: Audited identifiable web subset; app identities unresolved. Test screenshots: 23.
Ranking uses mean P(DP) over the seeded full-fusion models (42, 43, 44), threshold 0.5. This is a derived ensemble ranking, separate from the per-seed ablation metrics.
Wrong-class confidence is P(DP) for false positives and 1−P(DP) for false negatives. These scores are not calibrated confidence estimates.

Requested up to 20 unique examples per error type; found 2 false positives and 8 false negatives. No examples are duplicated to fill the quota.

![Error overview](assets/error_contact_sheet.png)

## Pattern-specific binary detection

Each slice contains screenshots annotated with that pattern plus the same benign controls. Other positive types are excluded, not relabeled negative. Mixed-pattern screenshots can occur in several slices; rows are not additive. This measures binary DP detection within a type, not pattern classification.
The table summarizes the original per-seed full-fusion predictions, not the mean-probability ensemble. Precision/recall/F1 are positive-class metrics; PR-AUC is trapezoidal. Values are mean ± sample SD.

| Original pattern label | Positive support | Benign controls | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ACTIVITY MESSAGE | 3 | 13 | 0.708 ± 0.036 | 0.111 ± 0.192 | 0.111 ± 0.192 | 0.111 ± 0.192 | 0.624 ± 0.039 | 0.233 ± 0.023 |
| ATTENTION DISTRACTION | 0 | 13 | — | — | — | — | — | — |
| COUNTDOWN TIMER | 5 | 13 | 0.667 ± 0.000 | 0.333 ± 0.000 | 0.200 ± 0.000 | 0.250 ± 0.000 | 0.559 ± 0.094 | 0.336 ± 0.089 |
| DEFAULT CHOICE | 1 | 13 | 0.857 ± 0.000 | 0.333 ± 0.000 | 1.000 ± 0.000 | 0.500 ± 0.000 | 1.000 ± 0.000 | 1.000 ± 0.000 |
| DISGUISED ADS | 0 | 13 | — | — | — | — | — | — |
| GAMIFICATION | 0 | 13 | — | — | — | — | — | — |
| HIGH DEMAND MESSAGE | 0 | 13 | — | — | — | — | — | — |
| LIMITED TIME MESSAGE | 3 | 13 | 0.750 ± 0.000 | 0.333 ± 0.000 | 0.333 ± 0.000 | 0.333 ± 0.000 | 0.692 ± 0.051 | 0.339 ± 0.159 |
| LOW STOCK MESSAGE | 1 | 13 | 0.786 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.179 ± 0.044 | 0.043 ± 0.002 |
| NAGGING | 0 | 13 | — | — | — | — | — | — |

Confirmshaming and hidden costs are not labels in these source annotations. They cannot receive verified category scores; absence from the vocabulary does not prove absence from screenshots. Original countdown/limited-time/low-stock labels are retained instead of inventing an urgency mapping.
All variants and exact per-seed slice metrics are in pattern_metrics.csv and pattern_per_seed.csv. Support is small; do not treat a perfect single-example rate as generalization evidence.

## Modality error profile

| Variant | False positives, mean ± SD | False negatives, mean ± SD |
| --- | ---: | ---: |
| visual | 2.000 ± 0.000 | 10.000 ± 0.000 |
| text | 3.000 ± 1.000 | 7.333 ± 2.082 |
| graph | 6.000 ± 2.000 | 3.667 ± 0.577 |
| visual+text | 2.000 ± 0.000 | 9.000 ± 1.000 |
| visual+graph | 2.667 ± 0.577 | 8.000 ± 0.000 |
| text+graph | 2.667 ± 1.528 | 6.667 ± 0.577 |
| visual+text+graph | 2.000 ± 0.000 | 7.667 ± 0.577 |
| tfidf_logistic | 0.000 ± 0.000 | 10.000 ± 0.000 |

## Ranked screenshots

Red boxes mark annotated DP regions; green marks the DINO crop footprint. Benign screenshots have no red DP boxes. Original images stay in ignored assets, not committed datasets.

### False positives

#### FP 1: houzz.com.png

P(DP)=0.5797; wrong-class confidence=0.5797; seeded models wrong=2/3. Labels: NO DP.
Visual-only P(DP)=0.2505, text-only=0.5390, graph-only=0.5539. These are separate trained heads, not causal contributions.

![houzz.com.png](assets/FP-01-384.png)

#### FP 2: crossrope.com.png

P(DP)=0.5700; wrong-class confidence=0.5700; seeded models wrong=3/3. Labels: NO DP.
Visual-only P(DP)=0.2426, text-only=0.4519, graph-only=0.4068. These are separate trained heads, not causal contributions.

![crossrope.com.png](assets/FP-02-370.png)

### False negatives

#### FN 1: (723)www.faithful-to-nature.co.za_9b6f.jpg

P(DP)=0.0884; wrong-class confidence=0.9116; seeded models wrong=3/3. Labels: LOW STOCK MESSAGE.
Visual-only P(DP)=0.0218, text-only=0.2208, graph-only=0.6213. These are separate trained heads, not causal contributions.
Fraction of each annotated DP box inside the visual crop ranges from 1.000 to 1.000. Box overlap is geometric evidence, not attention attribution.

![(723)www.faithful-to-nature.co.za_9b6f.jpg](assets/FN-01-488.png)

#### FN 2: (159)www.victorianplumbing.co.uk_62cc.jpg

P(DP)=0.1458; wrong-class confidence=0.8542; seeded models wrong=3/3. Labels: COUNTDOWN TIMER.
Visual-only P(DP)=0.0425, text-only=0.4476, graph-only=0.4568. These are separate trained heads, not causal contributions.
Fraction of each annotated DP box inside the visual crop ranges from 0.000 to 0.000. Box overlap is geometric evidence, not attention attribution.

![(159)www.victorianplumbing.co.uk_62cc.jpg](assets/FN-02-495.png)

#### FN 3: www.1800flowers.com.png

P(DP)=0.1481; wrong-class confidence=0.8519; seeded models wrong=3/3. Labels: ACTIVITY MESSAGE.
Visual-only P(DP)=0.0739, text-only=0.4001, graph-only=0.4538. These are separate trained heads, not causal contributions.
Fraction of each annotated DP box inside the visual crop ranges from 0.961 to 0.961. Box overlap is geometric evidence, not attention attribution.

![www.1800flowers.com.png](assets/FN-03-433.png)

#### FN 4: (449)www.victorianplumbing.co.uk_7777.jpg

P(DP)=0.1592; wrong-class confidence=0.8408; seeded models wrong=3/3. Labels: COUNTDOWN TIMER.
Visual-only P(DP)=0.0398, text-only=0.4710, graph-only=0.4336. These are separate trained heads, not causal contributions.
Fraction of each annotated DP box inside the visual crop ranges from 0.000 to 0.000. Box overlap is geometric evidence, not attention attribution.

![(449)www.victorianplumbing.co.uk_7777.jpg](assets/FN-04-463.png)

#### FN 5: beemission.com.png

P(DP)=0.1768; wrong-class confidence=0.8232; seeded models wrong=3/3. Labels: COUNTDOWN TIMER; LIMITED TIME MESSAGE.
Visual-only P(DP)=0.1314, text-only=0.2924, graph-only=0.3714. These are separate trained heads, not causal contributions.
Fraction of each annotated DP box inside the visual crop ranges from 0.240 to 1.000. Box overlap is geometric evidence, not attention attribution.

![beemission.com.png](assets/FN-05-342.png)

#### FN 6: mirraw.com.png

P(DP)=0.3655; wrong-class confidence=0.6345; seeded models wrong=3/3. Labels: COUNTDOWN TIMER; LIMITED TIME MESSAGE.
Visual-only P(DP)=0.2804, text-only=0.3272, graph-only=0.6706. These are separate trained heads, not causal contributions.
Fraction of each annotated DP box inside the visual crop ranges from 0.000 to 0.000. Box overlap is geometric evidence, not attention attribution.

![mirraw.com.png](assets/FN-06-344.png)

#### FN 7: droom.in.png

P(DP)=0.3935; wrong-class confidence=0.6065; seeded models wrong=2/3. Labels: ACTIVITY MESSAGE.
Visual-only P(DP)=0.0550, text-only=0.4090, graph-only=0.6433. These are separate trained heads, not causal contributions.
Fraction of each annotated DP box inside the visual crop ranges from 0.000 to 0.000. Box overlap is geometric evidence, not attention attribution.

![droom.in.png](assets/FN-07-339.png)

#### FN 8: www.stealthangelsurvival.com.png

P(DP)=0.4748; wrong-class confidence=0.5252; seeded models wrong=3/3. Labels: ACTIVITY MESSAGE.
Visual-only P(DP)=0.0590, text-only=0.4644, graph-only=0.5505. These are separate trained heads, not causal contributions.
Fraction of each annotated DP box inside the visual crop ranges from 0.223 to 0.223. Box overlap is geometric evidence, not attention attribution.

![www.stealthangelsurvival.com.png](assets/FN-08-448.png)

## Encoder attention visualizations

Maps use the evaluated frozen DINOv2 checkpoint and preprocessing. Cached embeddings are reproduced within the recorded floating-point tolerance. Heads are averaged, residual identity is added, rows are normalized, and attention matrices are multiplied across layers; CLS-to-patch mass is displayed on the actual crop.
This is [attention rollout](https://arxiv.org/abs/2005.00928), not GradCAM and not a class-specific causal explanation. The fusion head has no attention layer. Its trained states were not saved in the original experiment, so no classifier-gradient attribution is claimed. Per-example color scales differ and cannot be compared as absolute importance.

### houzz.com.png

![DINOv2 encoder attention](assets/attention-FP-1-384.png)

### crossrope.com.png

![DINOv2 encoder attention](assets/attention-FP-2-370.png)

### (723)www.faithful-to-nature.co.za_9b6f.jpg

![DINOv2 encoder attention](assets/attention-FN-1-488.png)

### (159)www.victorianplumbing.co.uk_62cc.jpg

![DINOv2 encoder attention](assets/attention-FN-2-495.png)

## Why modalities help or fail

The following separates measured observations from hypotheses. Separate modality heads are not causal interventions on a single fusion model; attention is not evidence of deceptive intent.

**Visual.** Visual-only misses 10 positives on average. Among the 8 mean-score full-fusion false negatives, 4 have all annotated DP boxes completely outside the encoder crop. The Victorian Plumbing countdowns sit to the right of the crop; Mirraw's timer is above it, and Droom's activity message is to its right. Those annotated pixels never reach DINOv2. This is a concrete preprocessing failure, though it does not establish how a different crop would change classification. Faithful to Nature's stock label is fully inside the crop and is still missed, so cropping alone cannot explain every error. Its rollout emphasizes product edges and controls more strongly than the small stock message; this is qualitative encoder attention, not a class attribution.

**Text.** Text-only has mean false negatives 7.333 and false positives 3.000. OCR is not always the bottleneck: 7 full-fusion false negatives retain at least one listed scarcity/activity cue within the actual token budget. The lexical checks and truncation status are in text_diagnostics.csv; they are not new ground-truth categories. The screenshots/OCR include stock counts, activity statements and countdown wording. A plausible limitation is that small-data training on raw OCR fails to learn when such text is manipulative, and the existing service uses a richer widget serialization. This hypothesis has not been isolated experimentally. Conversely, benign sale/free-trial wording on Houzz and Crossrope shows why keyword presence alone is insufficient.

**Graph.** Graph-only reduces mean false negatives to 3.667, while mean false positives rise to 6.000. On the Faithful to Nature miss, graph-only mean P(DP) is 0.621, whereas full fusion is 0.088. This supports a useful but nonspecific structural signal in this pilot. Graph nodes encode widget class/geometry/confidence, not stock-message meaning or whether a stated deadline is real. Detector errors and generic shopping-page structures are plausible causes of false alarms, not verified explanations for individual decisions.

**Fusion and label limits.** Crossrope is a full-fusion false positive even though the mean score of each single-modality head is below threshold. Fusion learns a different decision function; it does not average those three probabilities. Combining modalities can suppress graph-only recoveries or reinforce weak correlations. Houzz and Crossrope remain false positives under the supplied NO DP labels; screenshot-only evidence cannot resolve every annotation-policy or interaction-dependent ambiguity. No labels were changed to improve metrics.

Next experiments should preserve headers/right-hand banners with full-page or multi-scale visual inputs, retain text-to-widget associations, and validate detector/graph failures on manually checked examples. Any threshold or hyperparameter changes must use training/validation data, with a new held-out evaluation for confirmatory claims. These are proposed experiments, not measured improvements.

### OCR budget checks for ranked errors

| Screenshot | Tokens before truncation | Truncated | Diagnostic cues retained |
| --- | ---: | --- | --- |
| houzz.com.png | 292 | True | — |
| crossrope.com.png | 186 | False | — |
| (723)www.faithful-to-nature.co.za_9b6f.jpg | 296 | True | items available |
| (159)www.victorianplumbing.co.uk_62cc.jpg | 340 | True | HURRY; CODE ENDS |
| www.1800flowers.com.png | 311 | True | viewed this |
| (449)www.victorianplumbing.co.uk_7777.jpg | 337 | True | HURRY; CODE ENDS |
| beemission.com.png | 254 | False | ends soon; countdown |
| mirraw.com.png | 309 | True | — |
| droom.in.png | 237 | False | people are looking |
| www.stealthangelsurvival.com.png | 416 | True | HURRY |
