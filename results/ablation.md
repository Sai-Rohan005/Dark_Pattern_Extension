# Held-out ablation results

Scope: Audited identifiable web subset; app identities unresolved. Values are mean ± sample standard deviation across the configured training seeds.
PR-AUC is trapezoidal integration. Positive class is DARK PATTERN; confusion matrices are [[TN, FP], [FN, TP]].

| Variant | Status | Seeds completed | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | Confusion matrix (mean ± SD) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| visual | completed | 3 | 0.4783 ± 0.0000 | 0.0000 ± 0.0000 | 0.0000 ± 0.0000 | 0.0000 ± 0.0000 | 0.4359 ± 0.0160 | 0.3632 ± 0.0102 | [[11.0000 ± 0.0000, 2.0000 ± 0.0000], [10.0000 ± 0.0000, 0.0000 ± 0.0000]] |
| text | completed | 3 | 0.5507 ± 0.0905 | 0.4306 ± 0.1684 | 0.2667 ± 0.2082 | 0.3198 ± 0.2098 | 0.5641 ± 0.1195 | 0.4391 ± 0.0672 | [[10.0000 ± 1.0000, 3.0000 ± 1.0000], [7.3333 ± 2.0817, 2.6667 ± 2.0817]] |
| graph | completed | 3 | 0.5797 ± 0.0664 | 0.5222 ± 0.0694 | 0.6333 ± 0.0577 | 0.5685 ± 0.0282 | 0.6410 ± 0.0160 | 0.5812 ± 0.0278 | [[7.0000 ± 2.0000, 6.0000 ± 2.0000], [3.6667 ± 0.5774, 6.3333 ± 0.5774]] |
| visual+text | completed | 3 | 0.5217 ± 0.0435 | 0.2778 ± 0.2546 | 0.1000 ± 0.1000 | 0.1465 ± 0.1430 | 0.5256 ± 0.0178 | 0.4090 ± 0.0072 | [[11.0000 ± 0.0000, 2.0000 ± 0.0000], [9.0000 ± 1.0000, 1.0000 ± 1.0000]] |
| visual+graph | completed | 3 | 0.5362 ± 0.0251 | 0.4333 ± 0.0577 | 0.2000 ± 0.0000 | 0.2730 ± 0.0110 | 0.4308 ± 0.0353 | 0.3764 ± 0.0183 | [[10.3333 ± 0.5774, 2.6667 ± 0.5774], [8.0000 ± 0.0000, 2.0000 ± 0.0000]] |
| text+graph | completed | 3 | 0.5942 ± 0.0502 | 0.5833 ± 0.1443 | 0.3333 ± 0.0577 | 0.4160 ± 0.0364 | 0.6436 ± 0.0387 | 0.5232 ± 0.0608 | [[10.3333 ± 1.5275, 2.6667 ± 1.5275], [6.6667 ± 0.5774, 3.3333 ± 0.5774]] |
| visual+text+graph | completed | 3 | 0.5797 ± 0.0251 | 0.5333 ± 0.0577 | 0.2333 ± 0.0577 | 0.3238 ± 0.0660 | 0.5846 ± 0.0407 | 0.5581 ± 0.0334 | [[11.0000 ± 0.0000, 2.0000 ± 0.0000], [7.6667 ± 0.5774, 2.3333 ± 0.5774]] |
| tfidf_logistic | completed | 3 | 0.5652 ± 0.0000 | 0.0000 ± 0.0000 | 0.0000 ± 0.0000 | 0.0000 ± 0.0000 | 0.6077 ± 0.0000 | 0.4957 ± 0.0000 | [[13.0000 ± 0.0000, 0.0000 ± 0.0000], [10.0000 ± 0.0000, 0.0000 ± 0.0000]] |

All variants use identical split membership, test ordering, seeds and a fixed decision threshold.
Fusion uses freshly trained projection/concatenation heads on frozen embeddings, not inference-time masking of a full model.
Seed standard deviations measure training variation, not confidence intervals over sites. A deterministic baseline may have zero deviation.
Encoder pretraining overlap with these sites is unverified; these are not certified unseen-site results.

