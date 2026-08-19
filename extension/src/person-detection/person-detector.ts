import { env, pipeline } from "@huggingface/transformers";
import type { ExternalEntityCandidate } from "@accord/governance-core";
import { normalizeNerPersonTokens, type NerToken } from "./ner-normalizer";

export type PersonDetectionStatus = "ready" | "timeout" | "unavailable" | "error";

export type PersonDetectionCoverage = {
  mode: "hybrid-local-ner" | "hybrid-local-rules";
  nerStatus: PersonDetectionStatus;
  detector: string;
  candidateCount: number;
  timedOut: boolean;
  model: {
    name: string;
    assetSizeBytes: number;
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

type LocalNerPipeline = (
  text: string,
  options?: { ignore_labels?: string[] }
) => Promise<NerToken[]>;

const MODEL_ID = "accord-ner-v0.1";
const MODEL_THRESHOLD = 0.8;
const MODEL_DETECTOR = "accord_ner_v0_1";
const RULE_FALLBACK_DETECTOR = "local_person_detector_v1";
const DEFAULT_TIMEOUT_MS = 30_000;

const tokenPattern = /[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu;
const personParticles = new Set(["al", "bint", "bin", "da", "de", "del", "der", "di", "dos", "du", "la", "le", "van", "von"]);

let runtimeConfigured = false;
let pipelinePromise: Promise<LocalNerPipeline> | null = null;

export async function warmPersonDetector(): Promise<void> {
  await getNerPipeline();
}

export async function detectPersonCandidates(text: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<PersonDetectionResult> {
  if (!text.trim()) {
    return {
      candidates: [],
      coverage: coverage("ready", 0, false, "hybrid-local-ner", MODEL_DETECTOR)
    };
  }

  try {
    const candidates = await Promise.race([
      detectWithLocalNer(text),
      rejectAfter(timeoutMs)
    ]);

    return {
      candidates,
      coverage: coverage("ready", candidates.length, false, "hybrid-local-ner", MODEL_DETECTOR)
    };
  } catch (error) {
    const timedOut = error instanceof PersonDetectionTimeoutError;

    console.error("[Accord NER] local model failed", error);

    return {
      candidates: [],
      coverage: coverage(
        timedOut ? "timeout" : "error",
        0,
        timedOut,
        "hybrid-local-ner",
        MODEL_DETECTOR
      )
    };
  }
}

async function detectWithLocalNer(text: string): Promise<ExternalEntityCandidate[]> {
  const classifier = await getNerPipeline();
  const output = await classifier(text, { ignore_labels: ["O"] });

  return normalizeNerPersonTokens(text, output, MODEL_DETECTOR)
    .filter((candidate) => candidate.confidence >= MODEL_THRESHOLD)
    .map((candidate) => ({
      ...candidate,
      contextSignals: Array.from(new Set(["ner_person", "local_person_candidate", ...candidate.contextSignals]))
    }));
}

async function getNerPipeline(): Promise<LocalNerPipeline> {
  configureLocalRuntime();

  if (!pipelinePromise) {
    pipelinePromise = pipeline("token-classification", MODEL_ID, {
      dtype: "fp32"
    })
      .then((loaded) => loaded as unknown as LocalNerPipeline)
      .catch((error) => {
        pipelinePromise = null;
        throw error;
      });
  }

  return pipelinePromise;
}

function configureLocalRuntime() {
  if (runtimeConfigured) return;

  // The model and ONNX Runtime WASM binaries are packaged with the extension.
  // Remote model loading is disabled: PERSON detection never needs a backend.
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = chrome.runtime.getURL("models/");
  const wasm = env.backends.onnx.wasm;

if (!wasm) {
  throw new Error("ONNX Runtime WebAssembly backend is unavailable.");
}

wasm.wasmPaths = chrome.runtime.getURL("ort/");
wasm.proxy = false;
wasm.numThreads = 1;

  runtimeConfigured = true;
}

function detectWithRules(text: string): ExternalEntityCandidate[] {
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
        detector: RULE_FALLBACK_DETECTOR,
        contextSignals: Array.from(new Set(["local_person_candidate", ...contextSignals(nearby)]))
      });
    }
  }

  return uniqueBySpan(candidates);
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

function coverage(
  nerStatus: PersonDetectionStatus,
  candidateCount: number,
  timedOut: boolean,
  mode: PersonDetectionCoverage["mode"],
  detector: string
): PersonDetectionCoverage {
  return {
    mode,
    nerStatus,
    detector,
    candidateCount,
    timedOut,
    model: {
      name: MODEL_ID,
      assetSizeBytes: 0,
      executionContext: "service_worker"
    }
  };
}

class PersonDetectionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Local PERSON NER exceeded ${timeoutMs} ms.`);
    this.name = "PersonDetectionTimeoutError";
  }
}

function rejectAfter(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    globalThis.setTimeout(() => reject(new PersonDetectionTimeoutError(timeoutMs)), timeoutMs);
  });
}
