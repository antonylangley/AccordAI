from __future__ import annotations

import argparse
from pathlib import Path

from transformers import pipeline

from dataset_utils import load_jsonl, normalize_row
from evaluate_baseline import exact_entity_set, merge_person_predictions


MODEL_NAME = "dslim/distilbert-NER"

THRESHOLDS = [
    0.00,
    0.30,
    0.40,
    0.50,
    0.60,
    0.70,
    0.80,
    0.85,
    0.90,
    0.95,
    0.97,
    0.99,
]


def calculate_metrics(
    rows: list[dict],
    predictions_by_row: list[list[dict]],
    threshold: float,
) -> dict:
    tp = fp = fn = 0

    for row, predictions in zip(rows, predictions_by_row):
        filtered = [
            prediction
            for prediction in predictions
            if prediction["score"] >= threshold
        ]

        gold = exact_entity_set(row["entities"])
        pred = {
            (person["start"], person["end"])
            for person in filtered
        }

        tp += len(gold & pred)
        fp += len(pred - gold)
        fn += len(gold - pred)

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0

    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0
    )

    return {
        "threshold": threshold,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sweep PERSON confidence thresholds for Accord NER."
    )

    parser.add_argument(
        "dataset",
        type=Path,
    )

    parser.add_argument(
        "--model",
        default=MODEL_NAME,
    )

    args = parser.parse_args()

    rows = [
        normalize_row(row)
        for row in load_jsonl(args.dataset)
    ]

    if not rows:
        raise SystemExit("Dataset is empty.")

    print(f"Loading model: {args.model}")

    ner = pipeline(
        "token-classification",
        model=args.model,
        tokenizer=args.model,
        aggregation_strategy="simple",
    )

    predictions_by_row: list[list[dict]] = []

    print(f"Running inference on {len(rows)} rows...")

    for row in rows:
        raw_predictions = ner(row["text"])

        predicted_people = []

        for prediction in raw_predictions:
            if prediction.get("entity_group") != "PER":
                continue

            predicted_people.append(
                {
                    "text": row["text"][
                        prediction["start"]:prediction["end"]
                    ],
                    "start": int(prediction["start"]),
                    "end": int(prediction["end"]),
                    "score": float(prediction["score"]),
                }
            )

        predicted_people = merge_person_predictions(
            row["text"],
            predicted_people,
        )

        predictions_by_row.append(predicted_people)

    print()
    print(
        f"{'Threshold':<12}"
        f"{'Precision':<12}"
        f"{'Recall':<12}"
        f"{'F1':<12}"
        f"{'TP':<6}"
        f"{'FP':<6}"
        f"{'FN':<6}"
    )

    print("-" * 66)

    for threshold in THRESHOLDS:
        metrics = calculate_metrics(
            rows,
            predictions_by_row,
            threshold,
        )

        print(
            f"{metrics['threshold']:<12.2f}"
            f"{metrics['precision']:<12.4f}"
            f"{metrics['recall']:<12.4f}"
            f"{metrics['f1']:<12.4f}"
            f"{metrics['tp']:<6}"
            f"{metrics['fp']:<6}"
            f"{metrics['fn']:<6}"
        )


if __name__ == "__main__":
    main()