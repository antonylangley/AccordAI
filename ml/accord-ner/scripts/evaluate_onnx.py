from __future__ import annotations

import argparse
import json
from pathlib import Path

from optimum.onnxruntime import ORTModelForTokenClassification
from transformers import AutoTokenizer, pipeline


def load_jsonl(path: Path):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def gold_spans(row):
    text = row["text"]
    spans = []
    for entity in row["entities"]:
        entity_text = entity["text"]
        start = text.find(entity_text)
        if start < 0:
            raise ValueError(f"Gold entity {entity_text!r} not found in: {text!r}")
        spans.append((start, start + len(entity_text)))
    return set(spans)


def predicted_spans(ner, text: str, threshold: float):
    spans = set()
    for item in ner(text):
        label = str(item.get("entity_group", "")).upper()
        score = float(item["score"])
        if label not in {"PERSON", "PER"} or score < threshold:
            continue
        spans.add((int(item["start"]), int(item["end"])))
    return spans


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--threshold", type=float, default=0.50)
    parser.add_argument("dataset", type=Path)
    args = parser.parse_args()

    model = ORTModelForTokenClassification.from_pretrained(args.model)
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    ner = pipeline(
        "token-classification",
        model=model,
        tokenizer=tokenizer,
        aggregation_strategy="simple",
    )

    rows = load_jsonl(args.dataset)
    tp = fp = fn = 0
    errors = []

    for row in rows:
        gold = gold_spans(row)
        pred = predicted_spans(ner, row["text"], args.threshold)

        row_tp = gold & pred
        row_fp = pred - gold
        row_fn = gold - pred

        tp += len(row_tp)
        fp += len(row_fp)
        fn += len(row_fn)

        if row_fp or row_fn:
            errors.append(
                {
                    "text": row["text"],
                    "gold_spans": sorted(gold),
                    "predicted_spans": sorted(pred),
                    "false_positive_spans": sorted(row_fp),
                    "false_negative_spans": sorted(row_fn),
                }
            )

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    print(f"Model: {args.model}")
    print(f"Rows: {len(rows)}")
    print(f"TP={tp} FP={fp} FN={fn}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1:        {f1:.4f}")
    print(f"Error rows: {len(errors)}")


if __name__ == "__main__":
    main()
