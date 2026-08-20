from __future__ import annotations

import argparse
import random
import re
from collections import defaultdict
from pathlib import Path

from dataset_utils import load_jsonl, normalize_row, write_jsonl


def norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().casefold())


class DSU:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Create deterministic group-aware Accord PERSON splits. "
            "Rows sharing the same annotated PERSON identity or explicit group "
            "stay together, while preserving the requested split ratios."
        )
    )
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument("--train", type=float, default=0.70)
    parser.add_argument("--validation", type=float, default=0.15)
    parser.add_argument("--test", type=float, default=0.15)
    args = parser.parse_args()

    if abs((args.train + args.validation + args.test) - 1.0) > 1e-9:
        raise SystemExit("train + validation + test ratios must equal 1.0")

    raw_rows = load_jsonl(args.dataset)
    if len(raw_rows) < 20:
        raise SystemExit("Dataset is too small to split meaningfully.")

    normalized = [normalize_row(dict(row)) for row in raw_rows]
    dsu = DSU(len(raw_rows))

    # 1) Explicitly tagged groups stay together.
    explicit_group_first: dict[str, int] = {}
    for index, row in enumerate(raw_rows):
        group = row.get("group")
        if not group:
            continue
        key = norm(str(group))
        if key in explicit_group_first:
            dsu.union(index, explicit_group_first[key])
        else:
            explicit_group_first[key] = index

    # 2) Repeated annotated PERSON identities stay together.
    #
    # IMPORTANT:
    # We intentionally DO NOT connect every negative row that merely contains
    # a PERSON-like surface string. Names such as "Will", "May", "Summer", etc.
    # are also normal English words. Automatically joining every occurrence can
    # create giant accidental components and badly distort the split.
    person_first: dict[str, int] = {}
    for index, row in enumerate(normalized):
        for entity in row["entities"]:
            key = norm(entity["text"])
            if key in person_first:
                dsu.union(index, person_first[key])
            else:
                person_first[key] = index

    grouped_indices: dict[int, list[int]] = defaultdict(list)
    for index in range(len(raw_rows)):
        grouped_indices[dsu.find(index)].append(index)

    groups = list(grouped_indices.values())
    rng = random.Random(args.seed)
    rng.shuffle(groups)

    total_rows = len(raw_rows)
    total_positive = sum(bool(row["entities"]) for row in normalized)

    ratios = {
        "train": args.train,
        "validation": args.validation,
        "test": args.test,
    }
    target_rows = {
        name: round(total_rows * ratio)
        for name, ratio in ratios.items()
    }
    # Fix rounding drift on the largest split.
    target_rows["train"] += total_rows - sum(target_rows.values())

    target_positive = {
        name: total_positive * target_rows[name] / total_rows
        for name in ratios
    }

    assigned: dict[str, list[int]] = {
        "train": [],
        "validation": [],
        "test": [],
    }
    assigned_positive = {
        "train": 0,
        "validation": 0,
        "test": 0,
    }

    # Largest groups first, with seeded ordering retained for equal-sized groups.
    groups.sort(
        key=lambda indices: (
            -len(indices),
            -sum(bool(normalized[i]["entities"]) for i in indices),
        )
    )

    split_order = {"train": 0, "validation": 1, "test": 2}

    for group_indices in groups:
        group_rows = len(group_indices)
        group_positive = sum(
            bool(normalized[i]["entities"]) for i in group_indices
        )

        candidates = []
        for name in ("train", "validation", "test"):
            current_rows = len(assigned[name])
            current_positive = assigned_positive[name]

            row_fill = current_rows / max(1, target_rows[name])
            pos_fill = current_positive / max(1.0, target_positive[name])

            row_overflow = max(
                0, current_rows + group_rows - target_rows[name]
            ) / max(1, target_rows[name])

            pos_overflow = max(
                0.0,
                current_positive + group_positive - target_positive[name],
            ) / max(1.0, target_positive[name])

            # Fill all splits proportionally instead of greedily chasing
            # "closest-to-target" from an empty state.
            score = (
                row_fill
                + (0.35 if group_positive else 0.10) * pos_fill
                + 10.0 * row_overflow
                + 2.0 * pos_overflow
            )

            candidates.append((score, split_order[name], name))

        _, _, chosen = min(candidates)
        assigned[chosen].extend(group_indices)
        assigned_positive[chosen] += group_positive

    output_dirs = {
        "train": Path("data/train"),
        "validation": Path("data/validation"),
        "test": Path("data/test"),
    }
    stem = args.dataset.stem

    # Leakage check: a connected component can exist in only one split.
    component_split: dict[int, str] = {}
    for split_name, indices in assigned.items():
        for index in indices:
            root = dsu.find(index)
            previous = component_split.get(root)
            if previous is not None and previous != split_name:
                raise RuntimeError(
                    f"Group leakage detected: component {root} appears in "
                    f"{previous} and {split_name}"
                )
            component_split[root] = split_name

    # Extra leakage check: an annotated PERSON surface may not appear as an
    # annotated PERSON in multiple splits.
    identity_split: dict[str, str] = {}
    for split_name, indices in assigned.items():
        for index in indices:
            for entity in normalized[index]["entities"]:
                key = norm(entity["text"])
                previous = identity_split.get(key)
                if previous is not None and previous != split_name:
                    raise RuntimeError(
                        f"PERSON identity leakage: {entity['text']!r} appears "
                        f"in both {previous} and {split_name}"
                    )
                identity_split[key] = split_name

    for split_name, indices in assigned.items():
        split_rows = [normalized[i] for i in indices]
        rng.shuffle(split_rows)

        output = output_dirs[split_name] / f"{stem}.{split_name}.jsonl"
        write_jsonl(output, split_rows)

        positives = sum(bool(row["entities"]) for row in split_rows)
        entities = sum(len(row["entities"]) for row in split_rows)

        print(
            f"{split_name}: {len(split_rows)} rows, "
            f"{positives} positive rows, {entities} PERSON entities -> {output}"
        )

    max_group = max(len(group) for group in groups)
    print(f"Seed: {args.seed}")
    print(f"Connected groups: {len(groups)}")
    print(f"Largest connected group: {max_group} rows")
    print("Annotated PERSON identity leakage check: PASS")


if __name__ == "__main__":
    main()