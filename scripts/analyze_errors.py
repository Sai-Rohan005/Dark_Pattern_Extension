"""Build ranked screenshot and per-pattern error analysis from saved predictions."""
import argparse
from dpd.evaluation.error_analysis import analyze

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", default="results")
    parser.add_argument("--dataset-root", required=True)
    parser.add_argument("--output", default="results/error_analysis")
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    print(analyze(args.results, args.dataset_root, args.output, args.limit))
