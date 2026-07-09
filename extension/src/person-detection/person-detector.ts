import type { ExternalEntityCandidate } from "@accord/governance-core";

export type PersonDetectionStatus = "ready" | "timeout" | "unavailable" | "error";

export type PersonDetectionCoverage = {
  mode: "hybrid-local-rules";
  nerStatus: PersonDetectionStatus;
  detector: string;
  candidateCount: number;
  timedOut: boolean;
  model: {
    name: "none";
    assetSizeBytes: 0;
    executionContext: "service_worker";
  };
};

export type PersonDetectionResult = {
  candidates: ExternalEntityCandidate[];
  coverage: PersonDetectionCoverage;
};

type Token = {
  text: string;
  lower: string;
  start: number;
  end: number;
};

const detectorName = "local_person_detector_v1";
const tokenPattern = /[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu;
const personParticles = new Set(["al", "bint", "bin", "da", "de", "del", "der", "di", "dos", "du", "la", "le", "van", "von"]);

export async function detectPersonCandidates(text: string, timeoutMs = 120): Promise<PersonDetectionResult> {
  try {
    const result = await Promise.race([Promise.resolve(detectSynchronously(text)), timeout(timeoutMs)]);
    return result;
  } catch {
    return {
      candidates: [],
      coverage: coverage("error", 0, false)
    };
  }
}

function detectSynchronously(text: string): PersonDetectionResult {
  const tokens = collectTokens(text);
  const candidates: ExternalEntityCandidate[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    for (let length = 2; length <= 5; length += 1) {
      const windowTokens = tokens.slice(index, index + length);
      if (windowTokens.length !== length) continue;
      if (!tokensAreContiguous(text, windowTokens)) continue;
      if (!isCapitalizedNameToken(windowTokens[0].text)) continue;
      if (!isCapitalizedNameToken(windowTokens[windowTokens.length - 1].text)) continue;
      if (!windowTokens.every((token) => isCapitalizedNameToken(token.text) || personParticles.has(token.lower))) continue;

      const start = windowTokens[0].start;
      const end = windowTokens[windowTokens.length - 1].end;
      const originalText = text.slice(start, end);
      const nearby = text.slice(Math.max(0, start - 80), Math.min(text.length, end + 80));

      candidates.push({
        type: "PERSON",
        originalText,
        start,
        end,
        confidence: 0.7 + (length > 2 ? 0.04 : 0),
        detector: detectorName,
        contextSignals: Array.from(new Set(["local_person_candidate", ...contextSignals(nearby)]))
      });
    }
  }

  return {
    candidates: uniqueBySpan(candidates),
    coverage: coverage("unavailable", candidates.length, false)
  };
}

function collectTokens(text: string) {
  const tokens: Token[] = [];
  tokenPattern.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text))) {
    tokens.push({
      text: match[0],
      lower: match[0].toLocaleLowerCase().replace(/[’]/g, "'"),
      start: match.index,
      end: match.index + match[0].length
    });
    if (match[0] === "") tokenPattern.lastIndex += 1;
  }

  return tokens;
}

function tokensAreContiguous(text: string, tokens: Token[]) {
  for (let index = 1; index < tokens.length; index += 1) {
    if (!/^\s+$/.test(text.slice(tokens[index - 1].end, tokens[index].start))) return false;
  }

  return true;
}

function contextSignals(nearby: string) {
  const signals: string[] = [];
  if (/\b(?:ask|tell|email|message|contact|reply to|customer|client|patient|employee|candidate|reviewer|approver)\b/i.test(nearby)) {
    signals.push("near_name_context");
  }
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(nearby)) {
    signals.push("near_email");
  }
  if (/\b(?:approved|emailed|called|said|asked|signed|reviewed|completed|sent)\b/i.test(nearby)) {
    signals.push("near_human_action");
  }
  return signals;
}

function isCapitalizedNameToken(token: string) {
  const [first] = Array.from(token);
  if (!first) return false;
  return first === first.toLocaleUpperCase() && first !== first.toLocaleLowerCase() && !isAllUppercaseAcronym(token);
}

function isAllUppercaseAcronym(token: string) {
  const letters = Array.from(token).filter((char) => /\p{L}/u.test(char));
  return letters.length > 1 && letters.every((char) => char === char.toLocaleUpperCase());
}

function uniqueBySpan(candidates: ExternalEntityCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.start}:${candidate.end}:${candidate.originalText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function coverage(nerStatus: PersonDetectionStatus, candidateCount: number, timedOut: boolean): PersonDetectionCoverage {
  return {
    mode: "hybrid-local-rules",
    nerStatus,
    detector: detectorName,
    candidateCount,
    timedOut,
    model: {
      name: "none",
      assetSizeBytes: 0,
      executionContext: "service_worker"
    }
  };
}

function timeout(timeoutMs: number): Promise<PersonDetectionResult> {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      resolve({
        candidates: [],
        coverage: coverage("timeout", 0, true)
      });
    }, timeoutMs);
  });
}
