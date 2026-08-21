import type { ExternalEntityCandidate } from "@accord/governance-core";
import type { NerToken } from "./ner-normalizer";

export type NerTokenizer = {
  tokenize: (text: string, options?: { add_special_tokens?: boolean }) => string[];
};

export type LeadingIPersonPolicy = "drop" | "start";

export type OffsetNerNormalizerOptions = {
  leadingIPerson?: LeadingIPersonPolicy;
};

export type OffsetAlignmentDiagnostics = {
  tokenizerInputIdCount: number;
  sourceTokenCount: number;
  sourceAlignmentFailed: boolean;
  rejectedMissingIndex: number;
  rejectedInvalidIndex: number;
  rejectedNoPretokenSpan: number;
  alignedTokenCount: number;
};

export type OffsetDecoderDiagnostics = {
  rawPersonTokens: number;
  rejectedMalformedLeadingI: number;
  rejectedContinuationB: number;
  rejectedOffsetValidation: number;
  emittedCandidates: number;
};

type ActivePersonSpan = {
  start: number;
  end: number;
  scores: number[];
};

type SourceTokenSpan = { start: number; end: number } | null;

const personLabelPattern = /^(?:[BI]-)?(?:PER|PERSON)$/i;
const bertSourcePiecePattern = /[^\s\p{P}\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]+|[\p{P}\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]/gu;
const wordPiecePrefix = "##";
const maxUntokenizedGapCodeUnits = 2;

/**
 * Transformers.js 4.2 does not expose token-classification offsets. This
 * candidate adapter derives them from the exact model-token sequence while
 * retaining source pre-token boundaries. The resulting offsets are JavaScript
 * UTF-16 indices and are therefore directly compatible with String#slice.
 * If the two token streams cannot be matched exactly, it returns no tokens.
 */
export function addSourceOffsetsToNerTokens(
  text: string,
  tokens: NerToken[],
  tokenizer: NerTokenizer
): NerToken[] {
  return addSourceOffsetsToNerTokensWithDiagnostics(text, tokens, tokenizer).tokens;
}

export function addSourceOffsetsToNerTokensWithDiagnostics(
  text: string,
  tokens: NerToken[],
  tokenizer: NerTokenizer
): { tokens: NerToken[]; diagnostics: OffsetAlignmentDiagnostics } {
  const sourceTokenization = tokenizeSourceWithOffsets(text, tokenizer);
  const diagnostics: OffsetAlignmentDiagnostics = {
    tokenizerInputIdCount: sourceTokenization?.modelTokenCount ?? 0,
    sourceTokenCount: sourceTokenization?.sourceTokenCount ?? 0,
    sourceAlignmentFailed: sourceTokenization == null,
    rejectedMissingIndex: 0,
    rejectedInvalidIndex: 0,
    rejectedNoPretokenSpan: 0,
    alignedTokenCount: 0
  };

  if (!sourceTokenization) {
    diagnostics.rejectedNoPretokenSpan = tokens.length;
    return { tokens: [], diagnostics };
  }

  const alignedTokens: NerToken[] = [];
  for (const token of tokens) {
    if (token.index == null) {
      diagnostics.rejectedMissingIndex += 1;
      continue;
    }
    if (!Number.isInteger(token.index) || token.index < 0 || token.index >= sourceTokenization.offsets.length) {
      diagnostics.rejectedInvalidIndex += 1;
      continue;
    }
    const span = sourceTokenization.offsets[token.index];
    if (!span) {
      diagnostics.rejectedNoPretokenSpan += 1;
      continue;
    }
    alignedTokens.push({ ...token, start: span.start, end: span.end });
  }

  diagnostics.alignedTokenCount = alignedTokens.length;
  return { tokens: alignedTokens, diagnostics };
}

/**
 * Decodes raw BIO PERSON labels using source offsets only. B-PERSON always
 * closes an active span and starts a new one, unless it is emitted on a `##`
 * continuation that cannot be a valid source boundary. A malformed leading
 * I-PERSON is dropped by default; the explicit evaluation-only repair policy
 * can instead start a span there. O and every non-PERSON label close a span.
 */
export function normalizeOffsetNerPersonTokens(
  text: string,
  tokens: NerToken[],
  detector = "local_ner_model",
  options: OffsetNerNormalizerOptions = {}
): ExternalEntityCandidate[] {
  return normalizeOffsetNerPersonTokensWithDiagnostics(text, tokens, detector, options).candidates;
}

export function normalizeOffsetNerPersonTokensWithDiagnostics(
  text: string,
  tokens: NerToken[],
  detector = "local_ner_model",
  options: OffsetNerNormalizerOptions = {}
): { candidates: ExternalEntityCandidate[]; diagnostics: OffsetDecoderDiagnostics } {
  const candidates: ExternalEntityCandidate[] = [];
  const diagnostics: OffsetDecoderDiagnostics = {
    rawPersonTokens: 0,
    rejectedMalformedLeadingI: 0,
    rejectedContinuationB: 0,
    rejectedOffsetValidation: 0,
    emittedCandidates: 0
  };
  const leadingIPerson = options.leadingIPerson ?? "drop";
  let active: ActivePersonSpan | null = null;
  let suppressMalformedContinuation = false;

  const flush = () => {
    if (!active) return;
    const span = active;
    active = null;
    if (!isValidSpan(text, span.start, span.end)) {
      diagnostics.rejectedOffsetValidation += 1;
      return;
    }

    candidates.push({
      type: "PERSON",
      originalText: text.slice(span.start, span.end),
      start: span.start,
      end: span.end,
      confidence: average(span.scores),
      detector,
      contextSignals: ["ner_person"]
    });
  };

  for (const token of tokens) {
    const label = normalizeNerLabel(token);
    const span = normalizeTokenSpan(text, token);

    if (label) diagnostics.rawPersonTokens += 1;

    if (!label || !span) {
      if (label && !span) diagnostics.rejectedOffsetValidation += 1;
      flush();
      suppressMalformedContinuation = false;
      continue;
    }

    if (label.startsWith("B-")) {
      flush();
      if (token.word?.startsWith(wordPiecePrefix)) {
        diagnostics.rejectedContinuationB += 1;
        suppressMalformedContinuation = true;
        continue;
      }
      suppressMalformedContinuation = false;
      active = { start: span.start, end: span.end, scores: [scoreOf(token)] };
      continue;
    }

    if (suppressMalformedContinuation) continue;

    if (!active) {
      if (leadingIPerson === "start") {
        active = { start: span.start, end: span.end, scores: [scoreOf(token)] };
      } else {
        diagnostics.rejectedMalformedLeadingI += 1;
      }
      continue;
    }

    if (!isSafeGap(text, active.end, span.start)) {
      flush();
      if (leadingIPerson === "start") {
        active = { start: span.start, end: span.end, scores: [scoreOf(token)] };
      }
      continue;
    }

    active.end = span.end;
    active.scores.push(scoreOf(token));
  }

  flush();
  const dedupedCandidates = dedupeCandidates(candidates);
  diagnostics.emittedCandidates = dedupedCandidates.length;
  return { candidates: dedupedCandidates, diagnostics };
}

function tokenizeSourceWithOffsets(
  text: string,
  tokenizer: NerTokenizer
): { offsets: SourceTokenSpan[]; modelTokenCount: number; sourceTokenCount: number } | null {
  const modelTokens = tokenizer.tokenize(text, { add_special_tokens: true });
  const tokenizedPieces: Array<{ token: string; start: number; end: number }> = [];

  for (const match of text.matchAll(bertSourcePiecePattern)) {
    const sourcePiece = match[0];
    const sourceStart = match.index;
    const pieceTokens = tokenizer.tokenize(sourcePiece, { add_special_tokens: false });
    const pieceSpans = mapWordPiecesToSource(sourcePiece, sourceStart, pieceTokens);
    if (!pieceSpans) return null;
    for (let index = 0; index < pieceTokens.length; index += 1) {
      tokenizedPieces.push({ token: pieceTokens[index], ...pieceSpans[index] });
    }
  }

  const offsets: SourceTokenSpan[] = [];
  let sourceTokenIndex = 0;
  for (const modelToken of modelTokens) {
    const sourceToken = tokenizedPieces[sourceTokenIndex];
    if (sourceToken?.token === modelToken) {
      offsets.push({ start: sourceToken.start, end: sourceToken.end });
      sourceTokenIndex += 1;
    } else {
      offsets.push(null);
    }
  }

  return sourceTokenIndex === tokenizedPieces.length
    ? {
        offsets,
        modelTokenCount: modelTokens.length,
        sourceTokenCount: tokenizedPieces.length
      }
    : null;
}

function mapWordPiecesToSource(
  sourcePiece: string,
  sourceStart: number,
  pieceTokens: string[]
): Array<{ start: number; end: number }> | null {
  if (pieceTokens.length === 0) return null;
  if (pieceTokens.length === 1 && pieceTokens[0] === "[UNK]") {
    return [{ start: sourceStart, end: sourceStart + sourcePiece.length }];
  }
  if (pieceTokens.some((token) => token === "[UNK]")) return null;

  const codePoints = Array.from(sourcePiece);
  const codeUnitBoundaries = [0];
  for (const codePoint of codePoints) {
    codeUnitBoundaries.push(codeUnitBoundaries[codeUnitBoundaries.length - 1] + codePoint.length);
  }

  const spans: Array<{ start: number; end: number }> = [];
  let codePointCursor = 0;
  for (const token of pieceTokens) {
    const surface = token.startsWith(wordPiecePrefix) ? token.slice(wordPiecePrefix.length) : token;
    const codePointLength = Array.from(surface).length;
    if (!surface || codePointCursor + codePointLength > codePoints.length) return null;
    spans.push({
      start: sourceStart + codeUnitBoundaries[codePointCursor],
      end: sourceStart + codeUnitBoundaries[codePointCursor + codePointLength]
    });
    codePointCursor += codePointLength;
  }

  return codePointCursor === codePoints.length ? spans : null;
}

function normalizeNerLabel(token: NerToken) {
  const raw = token.entity || token.label || token.entity_group || "";
  const label = raw.trim().toUpperCase();
  if (!label || label === "O" || !personLabelPattern.test(label)) return null;
  return label.includes("-") ? label : `I-${label}`;
}

function normalizeTokenSpan(text: string, token: NerToken) {
  if (!Number.isInteger(token.start) || !Number.isInteger(token.end)) return null;
  const start = token.start as number;
  const end = token.end as number;
  return isValidSpan(text, start, end) ? { start, end } : null;
}

function isValidSpan(text: string, start: number, end: number) {
  return start >= 0 && end > start && end <= text.length;
}

function isSafeGap(text: string, previousEnd: number, nextStart: number) {
  if (nextStart < previousEnd) return false;
  const gap = text.slice(previousEnd, nextStart);
  return gap.length <= maxUntokenizedGapCodeUnits && !/[\r\n\u2028\u2029]/u.test(gap);
}

function scoreOf(token: NerToken) {
  return typeof token.score === "number" && Number.isFinite(token.score)
    ? clamp(token.score, 0, 1)
    : 0.9;
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
