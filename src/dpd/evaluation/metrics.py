"""Binary metrics; PR-AUC uses trapezoidal integration, not average precision."""
import numpy as np
from sklearn.metrics import (accuracy_score, auc, confusion_matrix, f1_score,
                             precision_recall_curve, precision_score, recall_score,
                             roc_auc_score)

METRICS = ("accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc", "tn", "fp", "fn", "tp")


def binary_metrics(labels, probabilities, threshold):
    labels, probabilities = np.asarray(labels), np.asarray(probabilities)
    if labels.ndim != 1 or probabilities.shape != labels.shape or set(labels.tolist()) != {0, 1}:
        raise ValueError("Metrics require equally sized vectors and both binary classes")
    if not np.isfinite(probabilities).all() or ((probabilities < 0) | (probabilities > 1)).any():
        raise ValueError("Probabilities must be finite and in [0, 1]")
    predictions = probabilities >= threshold
    precision, recall, _ = precision_recall_curve(labels, probabilities)
    tn, fp, fn, tp = confusion_matrix(labels, predictions, labels=[0, 1]).ravel()
    return dict(accuracy=accuracy_score(labels, predictions),
                precision=precision_score(labels, predictions, zero_division=0),
                recall=recall_score(labels, predictions, zero_division=0),
                f1=f1_score(labels, predictions, zero_division=0),
                roc_auc=roc_auc_score(labels, probabilities), pr_auc=auc(recall, precision),
                tn=int(tn), fp=int(fp), fn=int(fn), tp=int(tp))
