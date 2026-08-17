from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

ALLOWED_LABELS = {"PERSON"}


@dataclass(frozen=True)
class Span:
    start: int
    end: int
    label: str
    text: str


def load_jsonl(path: str | Path) -> list[dict]:
    path = Path(path)
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_no, raw in enumerate(handle, start=1):
            line = raw.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_no}: invalid JSON: {exc}") from exc
            row["__line__"] = line_no
            rows.append(row)
    return rows


def resolve_entity_spans(row: dict) -> list[Span]:
    line_no = row.get("__line__", "?")
    text = row.get("text")
    entities = row.get("entities")

    if not isinstance(text, str) or not text.strip():
        raise ValueError(f"line {line_no}: 'text' must be a non-empty string")
    if not isinstance(entities, list):
        raise ValueError(f"line {line_no}: 'entities' must be a list")

    spans: list[Span] = []
    for idx, entity in enumerate(entities):
        if not isinstance(entity, dict):
            raise ValueError(f"line {line_no}, entity {idx}: entity must be an object")

        entity_text = entity.get("text")
        label = entity.get("label")
        if not isinstance(entity_text, str) or not entity_text:
            raise ValueError(f"line {line_no}, entity {idx}: missing non-empty entity text")
        if label not in ALLOWED_LABELS:
            raise ValueError(
                f"line {line_no}, entity {idx}: label {label!r} is invalid; "
                f"allowed labels: {sorted(ALLOWED_LABELS)}"
            )

        matches: list[int] = []
        start = 0
        while True:
            pos = text.find(entity_text, start)
            if pos == -1:
                break
            matches.append(pos)
            start = pos + 1

        if not matches:
            raise ValueError(
                f"line {line_no}, entity {idx}: {entity_text!r} does not occur in text"
            )
        if len(matches) > 1:
            raise ValueError(
                f"line {line_no}, entity {idx}: {entity_text!r} occurs {len(matches)} times. "
                "The human-authored format requires a unique occurrence; rewrite the example "
                "or later add explicit offsets."
            )

        start = matches[0]
        spans.append(Span(start=start, end=start + len(entity_text), label=label, text=entity_text))

    spans.sort(key=lambda span: (span.start, span.end))
    for previous, current in zip(spans, spans[1:]):
        if current.start < previous.end:
            raise ValueError(
                f"line {line_no}: overlapping entities {previous.text!r} and {current.text!r}"
            )

    return spans


def normalize_row(row: dict) -> dict:
    spans = resolve_entity_spans(row)
    return {
        "text": row["text"],
        "entities": [
            {
                "text": span.text,
                "label": span.label,
                "start": span.start,
                "end": span.end,
            }
            for span in spans
        ],
    }


def normalized_rows(rows: Iterable[dict]) -> list[dict]:
    return [normalize_row(row) for row in rows]


def write_jsonl(path: str | Path, rows: Iterable[dict]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
