from __future__ import annotations

import argparse
import json
from pathlib import Path

from dataset_utils import load_jsonl, normalize_row


def clean_loaded_row(row: dict) -> dict:
    row = dict(row)
    row.pop("__line__", None)
    return row


def validate_rows(rows: list[dict], source: Path) -> None:
    failures: list[str] = []
    for index, row in enumerate(rows, start=1):
        try:
            normalize_row(dict(row))
        except ValueError as exc:
            failures.append(f"{source}:{index}: {exc}")

    if failures:
        print(f"FAILED: {len(failures)} invalid row(s)")
        for failure in failures:
            print("-", failure)
        raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Combine Accord PERSON v2 with curated v3 additions."
    )
    parser.add_argument(
        "--base",
        type=Path,
        default=Path("data/raw/accord_person_v2.jsonl"),
    )
    parser.add_argument(
        "--additions",
        type=Path,
        default=Path("data/raw/accord_person_v3_additions.jsonl"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/raw/accord_person_v3.jsonl"),
    )
    args = parser.parse_args()

    base = [clean_loaded_row(row) for row in load_jsonl(args.base)]
    additions = [clean_loaded_row(row) for row in load_jsonl(args.additions)]

    validate_rows(base, args.base)
    validate_rows(additions, args.additions)

    combined = base + additions

    seen: dict[str, str] = {}
    duplicates: list[str] = []
    for index, row in enumerate(combined, start=1):
        text = row["text"].strip()
        source = "base" if index <= len(base) else "additions"
        if text in seen:
            duplicates.append(
                f"{text!r} appears in both/within {seen[text]} and {source}"
            )
        else:
            seen[text] = source

    if duplicates:
        print("Duplicate text detected. Fix these before training:")
        for duplicate in duplicates:
            print("-", duplicate)
        raise SystemExit(1)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        for row in combined:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    positive_rows = sum(bool(row.get("entities")) for row in combined)
    negative_rows = len(combined) - positive_rows
    entity_count = sum(len(row.get("entities") or []) for row in combined)

    print("Accord PERSON v3 built")
    print("======================")
    print(f"Base rows:       {len(base)}")
    print(f"Addition rows:   {len(additions)}")
    print(f"Total rows:      {len(combined)}")
    print(f"Positive rows:   {positive_rows}")
    print(f"Negative rows:   {negative_rows}")
    print(f"PERSON entities: {entity_count}")
    print(f"Output:           {args.output}")


if __name__ == "__main__":
    main()
