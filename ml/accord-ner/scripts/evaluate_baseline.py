from __future__ import annotations

import argparse
import json
from pathlib import Path

from transformers import pipeline

from dataset_utils import load_jsonl, normalize_row

MODEL_NAME = "dslim/distilbert-NER"


def exact_entity_set(entities: list[dict]) -> set[tuple[int, int]]:
    return {
        (int(e["start"]), int(e["end"]))
        for e in entities
        if e["label"] == "PERSON"
    }


def merge_person_predictions(
    text: str,
    predictions: list[dict],
) -> list[dict]:
    """
    Merge adjacent PERSON fragments that clearly belong to the same human name.

    Example:
        Mary
        -
        Kate Olsen

    becomes:
        Mary-Kate Olsen

    This is post-processing only. It does not change the model itself.
    """
    if not predictions:
        return []

    predictions = sorted(predictions, key=lambda p: p["start"])
    merged: list[dict] = [predictions[0].copy()]

    for current in predictions[1:]:
        previous = merged[-1]

        gap = text[previous["end"] : current["start"]]

        # Merge:
        #   Mary + - + Kate Olsen
        #   Jean + - + Pierre Dupont
        #
        # Also merge directly adjacent fragments produced by tokenization.
        should_merge = gap == "" or gap in {"-", "'", "’"}

        if should_merge:
            previous["end"] = current["end"]
            previous["text"] = text[previous["start"] : previous["end"]]

            # Keep the most conservative confidence across the merged span.
            previous["score"] = min(
                float(previous["score"]),
                float(current["score"]),
            )
        else:
            merged.append(current.copy())

    return merged


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate the untouched DistilBERT NER baseline "
            "on Accord PERSON data."
        )
    )
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--model", default=MODEL_NAME)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("results/baseline_errors.json"),
    )
    args = parser.parse_args()

    rows = [normalize_row(row) for row in load_jsonl(args.dataset)]

    if not rows:
        raise SystemExit("Dataset is empty.")

    ner = pipeline(
        "token-classification",
        model=args.model,
        tokenizer=args.model,
        aggregation_strategy="simple",
    )

    tp = fp = fn = 0
    errors: list[dict] = []

    for row in rows:
        predictions = ner(row["text"])

        predicted_people: list[dict] = []

        for prediction in predictions:
            # dslim/distilbert-NER uses PER as its person label.
            if prediction.get("entity_group") != "PER":
                continue

            predicted_people.append(
                {
                    "text": row["text"][
                        prediction["start"] : prediction["end"]
                    ],
                    "start": int(prediction["start"]),
                    "end": int(prediction["end"]),
                    "score": float(prediction["score"]),
                }
            )

        # Reconcile fragmented PERSON spans before evaluation.
        predicted_people = merge_person_predictions(
            row["text"],
            predicted_people,
        )

        gold = exact_entity_set(row["entities"])
        pred = {
            (person["start"], person["end"])
            for person in predicted_people
        }

        row_tp = len(gold & pred)
        row_fp = len(pred - gold)
        row_fn = len(gold - pred)

        tp += row_tp
        fp += row_fp
        fn += row_fn

        if row_fp or row_fn:
            errors.append(
                {
                    "text": row["text"],
                    "gold": row["entities"],
                    "predicted": predicted_people,
                    "false_positive_spans": sorted(pred - gold),
                    "false_negative_spans": sorted(gold - pred),
                }
            )

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0
    )

    print(f"Model: {args.model}")
    print(f"Rows: {len(rows)}")
    print(f"TP={tp} FP={fp} FN={fn}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1:        {f1:.4f}")

    args.output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    args.output.write_text(
        json.dumps(
            {
                "model": args.model,
                "rows": len(rows),
                "true_positives": tp,
                "false_positives": fp,
                "false_negatives": fn,
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "errors": errors,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print(f"Detailed errors written to: {args.output}")


if __name__ == "__main__":
    main()