from __future__ import annotations

import argparse
import random
from pathlib import Path

from dataset_utils import load_jsonl, normalize_row, write_jsonl


def main() -> None:
    parser = argparse.ArgumentParser(description="Create deterministic Accord NER train/validation/test splits.")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument("--train", type=float, default=0.70)
    parser.add_argument("--validation", type=float, default=0.15)
    parser.add_argument("--test", type=float, default=0.15)
    args = parser.parse_args()

    if abs((args.train + args.validation + args.test) - 1.0) > 1e-9:
        raise SystemExit("train + validation + test ratios must equal 1.0")

    rows = [normalize_row(row) for row in load_jsonl(args.dataset)]
    if len(rows) < 20:
        raise SystemExit("Dataset is too small to split meaningfully (need at least 20 rows).")

    # Stratify only by whether a row contains at least one PERSON span. This keeps
    # the initial positive/negative balance similar across splits without adding
    # a heavy dependency.
    positive = [row for row in rows if row["entities"]]
    negative = [row for row in rows if not row["entities"]]

    rng = random.Random(args.seed)
    rng.shuffle(positive)
    rng.shuffle(negative)

    def partition(group: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
        n = len(group)
        train_end = round(n * args.train)
        validation_end = train_end + round(n * args.validation)
        return group[:train_end], group[train_end:validation_end], group[validation_end:]

    p_train, p_val, p_test = partition(positive)
    n_train, n_val, n_test = partition(negative)

    splits = {
        "train": p_train + n_train,
        "validation": p_val + n_val,
        "test": p_test + n_test,
    }

    stem = args.dataset.stem
    output_dirs = {
        "train": Path("data/train"),
        "validation": Path("data/validation"),
        "test": Path("data/test"),
    }

    for name, split_rows in splits.items():
        rng.shuffle(split_rows)
        path = output_dirs[name] / f"{stem}.{name}.jsonl"
        write_jsonl(path, split_rows)
        positives = sum(bool(row["entities"]) for row in split_rows)
        print(f"{name}: {len(split_rows)} rows ({positives} positive) -> {path}")


if __name__ == "__main__":
    main()
