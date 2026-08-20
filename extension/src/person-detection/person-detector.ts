import { env, pipeline } from "@huggingface/transformers";
import type { ExternalEntityCandidate } from "@accord/governance-core";
import { normalizeNerPersonTokens, type NerToken } from "./ner-normalizer";

export type PersonDetectionStatus = "ready" | "timeout" | "unavailable" | "error";

export type PersonDetectionCoverage = {
  mode: "local-ner";
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

type LocalNerPipeline = (
  text: string,
  options?: {
    ignore_labels?: string[];
    aggregation_strategy?: "none" | "simple";
  }
) => Promise<NerToken[]>;

const MODEL_ID = "accord-ner-v0.2";
const MODEL_THRESHOLD = 0.5;
const MODEL_DETECTOR = "accord_ner_v0_2";
const DEFAULT_TIMEOUT_MS = 30_000;

let runtimeConfigured = false;
let pipelinePromise: Promise<LocalNerPipeline> | null = null;
let assetProbePromise: Promise<void> | null = null;

export async function warmPersonDetector(): Promise<void> {
  await getNerPipeline();
}

export async function detectPersonCandidates(text: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<PersonDetectionResult> {
  if (!text.trim()) {
    return {
      candidates: [],
      coverage: coverage("ready", 0, false, "local-ner", MODEL_DETECTOR)
    };
  }

  try {
    const candidates = await Promise.race([
      detectWithLocalNer(text),
      rejectAfter(timeoutMs)
    ]);

    return {
      candidates,
      coverage: coverage("ready", candidates.length, false, "local-ner", MODEL_DETECTOR)
    };
  } catch (error) {
    const timedOut = error instanceof PersonDetectionTimeoutError;
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        : {
            name: "UnknownError",
            message: String(error)
          };

    console.error(
      `[Accord NER] local model failed | model=${MODEL_ID} | timedOut=${timedOut} | ${errorDetails.name}: ${errorDetails.message}`
    );
    if (errorDetails.stack) {
      console.error("[Accord NER] failure stack", errorDetails.stack);
    }

    return {
      candidates: [],
      coverage: coverage(
        timedOut ? "timeout" : "error",
        0,
        timedOut,
        "local-ner",
        MODEL_DETECTOR
      )
    };
  }
}

async function detectWithLocalNer(text: string): Promise<ExternalEntityCandidate[]> {
  const classifier = await getNerPipeline();
  const output = await classifier(text, {
    ignore_labels: ["O"],
    aggregation_strategy: "simple"
  });

  return normalizeNerPersonTokens(text, output, MODEL_DETECTOR)
    .filter((candidate) => candidate.confidence >= MODEL_THRESHOLD)
    .map((candidate) => ({
      ...candidate,
      contextSignals: Array.from(new Set(["ner_person", ...candidate.contextSignals]))
    }));
}

async function getNerPipeline(): Promise<LocalNerPipeline> {
  configureLocalRuntime();

  if (!pipelinePromise) {
    pipelinePromise = probeLocalAssets()
      .then(() => pipeline("token-classification", MODEL_ID, {
        dtype: "q8"
      }))
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
  env.useFS = false;
  env.useFSCache = false;
  env.useBrowserCache = false;
  env.useWasmCache = false;
  env.localModelPath = chrome.runtime.getURL("models/");

  console.info("[Accord NER] fetch runtime", {
    hasGlobalFetch: typeof globalThis.fetch === "function",
    hasEnvFetch: typeof env.fetch === "function",
    sameFetch: env.fetch === globalThis.fetch,
    useFS: env.useFS,
    allowLocalModels: env.allowLocalModels,
    allowRemoteModels: env.allowRemoteModels,
    localModelPath: env.localModelPath
  });

  if (typeof globalThis.fetch === "function" && env.fetch !== globalThis.fetch) {
    env.fetch = globalThis.fetch.bind(globalThis);
  }

  const wasm = env.backends.onnx.wasm;

  if (!wasm) {
    throw new Error("ONNX Runtime WebAssembly backend is unavailable.");
  }

  wasm.wasmPaths = {
    wasm: chrome.runtime.getURL("ort/ort-wasm-simd-threaded.asyncify.wasm")
  };
  wasm.proxy = false;
  wasm.numThreads = 1;

  runtimeConfigured = true;
}

function probeLocalAssets(): Promise<void> {
  if (!assetProbePromise) {
    assetProbePromise = Promise.all([
      probeLocalAsset("config.json", chrome.runtime.getURL("models/accord-ner-v0.2/config.json")),
      probeLocalAsset("tokenizer.json", chrome.runtime.getURL("models/accord-ner-v0.2/tokenizer.json")),
      probeLocalAsset(
        "ort-wasm-simd-threaded.asyncify.wasm",
        chrome.runtime.getURL("ort/ort-wasm-simd-threaded.asyncify.wasm")
      )
    ]).then(() => undefined);
  }

  return assetProbePromise;
}

async function probeLocalAsset(asset: string, url: string): Promise<void> {
  const response = await globalThis.fetch(url);
  console.info("[Accord NER] asset probe", {
    asset,
    url,
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type")
  });
  await response.body?.cancel();
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
