from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

from dataset_utils import load_jsonl, normalize_row, write_jsonl


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate an Accord NER JSONL dataset.")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--output", type=Path, help="Optional normalized JSONL output with offsets.")
    args = parser.parse_args()

    rows = load_jsonl(args.dataset)
    if not rows:
        raise SystemExit("Dataset is empty.")

    normalized = []
    failures: list[str] = []
    for row in rows:
        try:
            normalized.append(normalize_row(row))
        except ValueError as exc:
            failures.append(str(exc))

    if failures:
        print(f"FAILED: {len(failures)} invalid row(s)\n")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    positive_rows = sum(bool(row["entities"]) for row in normalized)
    negative_rows = len(normalized) - positive_rows
    entity_counts = Counter(
        entity["label"]
        for row in normalized
        for entity in row["entities"]
    )

    print("Dataset valid")
    print(f"Rows: {len(normalized)}")
    print(f"Positive rows: {positive_rows}")
    print(f"Negative rows: {negative_rows}")
    print(f"Entity counts: {dict(entity_counts)}")

    if args.output:
        write_jsonl(args.output, normalized)
        print(f"Normalized dataset written to: {args.output}")


if __name__ == "__main__":
    main()
