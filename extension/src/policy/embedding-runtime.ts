import { env, pipeline } from "@huggingface/transformers";

export const POLICY_EMBEDDING_MODEL_ID = "accord-policy-embedding-v1";
export const POLICY_EMBEDDING_DIMENSIONS = 384;

type FeatureExtractionPipeline = (
  input: string | string[],
  options: { pooling: "mean"; normalize: true }
) => Promise<{ tolist(): unknown }>;

let runtimeConfigured = false;
let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

export async function embedPolicySentences(sentences: string[]): Promise<number[][]> {
  if (!sentences.length) return [];
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(sentences, { pooling: "mean", normalize: true });
  const vectors = output.tolist();
  if (!Array.isArray(vectors)) throw new Error("Policy embedding output was not an array.");

  const normalized = (sentences.length === 1 && typeof vectors[0] === "number" ? [vectors] : vectors) as unknown[];
  if (
    normalized.length !== sentences.length ||
    normalized.some(
      (vector) =>
        !Array.isArray(vector) ||
        vector.length !== POLICY_EMBEDDING_DIMENSIONS ||
        vector.some((value) => typeof value !== "number" || !Number.isFinite(value))
    )
  ) {
    throw new Error("Policy embedding output had an unexpected shape.");
  }

  return normalized as number[][];
}

async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  configurePolicyEmbeddingRuntime();
  if (!pipelinePromise) {
    pipelinePromise = pipeline("feature-extraction", POLICY_EMBEDDING_MODEL_ID, { dtype: "q8" })
      .then((loaded) => loaded as unknown as FeatureExtractionPipeline)
      .catch((error) => {
        pipelinePromise = null;
        throw error;
      });
  }
  return pipelinePromise;
}

export function configurePolicyEmbeddingRuntime() {
  if (runtimeConfigured) return;
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.useFS = false;
  env.useFSCache = false;
  env.useBrowserCache = false;
  env.useWasmCache = false;
  env.localModelPath = chrome.runtime.getURL("models/");
  if (typeof globalThis.fetch === "function" && env.fetch !== globalThis.fetch) {
    env.fetch = globalThis.fetch.bind(globalThis);
  }

  const wasm = env.backends.onnx.wasm;
  if (!wasm) throw new Error("ONNX Runtime WebAssembly backend is unavailable.");
  wasm.wasmPaths = { wasm: chrome.runtime.getURL("ort/ort-wasm-simd-threaded.asyncify.wasm") };
  wasm.proxy = false;
  wasm.numThreads = 1;
  runtimeConfigured = true;
}
