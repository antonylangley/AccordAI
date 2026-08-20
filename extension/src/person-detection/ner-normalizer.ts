import type { ExternalEntityCandidate } from "@accord/governance-core";

export type NerToken = {
  text?: string;
  word?: string;
  entity?: string;
  entity_group?: string;
  label?: string;
  score?: number;
  start?: number;
  end?: number;
};

type ActivePersonSpan = {
  start: number;
  end: number;
  scores: number[];
};

const personLabelPattern = /^(?:[BI]-)?(?:PER|PERSON)$/i;

export function normalizeNerPersonTokens(text: string, tokens: NerToken[], detector = "local_ner_model"): ExternalEntityCandidate[] {
  const candidates: ExternalEntityCandidate[] = [];
  let active: ActivePersonSpan | null = null;
  let alignmentCursor = 0;

  const flush = () => {
    if (!active) return;
    const scores = active.scores;
    const span = trimSourceSpan(text, active.start, active.end);
    active = null;
    if (!span) return;

    const originalText = text.slice(span.start, span.end);
    if (text.slice(span.start, span.end) !== originalText) return;

    candidates.push({
      type: "PERSON",
      originalText,
      start: span.start,
      end: span.end,
      confidence: average(scores),
      detector,
      contextSignals: ["ner_person"]
    });
  };

  for (const token of tokens) {
    const label = normalizeNerLabel(token);
    const span = normalizeTokenSpan(text, token, alignmentCursor);

    if (!label || !span) {
      flush();
      continue;
    }

    alignmentCursor = span.end;

    const beginsSpan = label.startsWith("B-");

    if (!active || beginsSpan || !isCompatibleGap(text.slice(active.end, span.start))) {
      flush();
      active = {
        start: span.start,
        end: span.end,
        scores: [scoreOf(token)]
      };
      continue;
    }

    active.end = span.end;
    active.scores.push(scoreOf(token));
  }

  flush();
  return dedupeCandidates(candidates);
}

function normalizeNerLabel(token: NerToken) {
  const raw = token.entity || token.label || token.entity_group || "";
  const label = raw.trim().toUpperCase();
  if (!label || label === "O") return null;
  if (!personLabelPattern.test(label)) return null;
  return label.includes("-") ? label : `I-${label}`;
}

function normalizeTokenSpan(text: string, token: NerToken, alignmentCursor: number) {
  if (Number.isInteger(token.start) && Number.isInteger(token.end)) {
    const start = token.start as number;
    const end = token.end as number;
    if (start < 0 || end <= start || end > text.length) return null;
    if (!text.slice(start, end)) return null;
    return { start, end };
  }

  const modelText = (token.word || token.text || "").trim();
  if (!modelText) return null;

  const start = text.indexOf(modelText, alignmentCursor);
  if (start < 0) return null;
  return { start, end: start + modelText.length };
}

function trimSourceSpan(text: string, start: number, end: number) {
  let nextStart = start;
  let nextEnd = end;

  while (nextStart < nextEnd && !isNameBoundaryChar(text[nextStart])) nextStart += 1;
  while (nextEnd > nextStart && !isNameBoundaryChar(text[nextEnd - 1])) nextEnd -= 1;
  if (nextEnd <= nextStart) return null;

  return {
    start: nextStart,
    end: nextEnd
  };
}

function isCompatibleGap(gap: string) {
  return /^[\s'’-]*$/u.test(gap);
}

function isNameBoundaryChar(char: string) {
  return /[\p{L}\p{M}]/u.test(char);
}

function scoreOf(token: NerToken) {
  return typeof token.score === "number" && Number.isFinite(token.score) ? clamp(token.score, 0, 1) : 0.9;
}

function average(values: number[]) {
  if (!values.length) return 0.9;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dedupeCandidates(candidates: ExternalEntityCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.start}:${candidate.end}:${candidate.originalText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
