import { beforeEach, expect, test, vi } from "vitest";

const transformers = vi.hoisted(() => {
  const classifier = Object.assign(
    vi.fn(async () => [
      { entity: "O", index: 1, score: 0.99 },
      { entity: "B-PERSON", index: 2, score: 0.99 },
      { entity: "I-PERSON", index: 3, score: 0.99 },
      { entity: "I-PERSON", index: 4, score: 0.99 }
    ]),
    {
      tokenizer: {
        tokenize(text: string) {
          const fixtures: Record<string, string[]> = {
            "Notify Jean-Pierre": ["[CLS]", "Notify", "Jean", "-", "Pierre", "[SEP]"],
            Notify: ["Notify"],
            Jean: ["Jean"],
            "-": ["-"],
            Pierre: ["Pierre"]
          };
          const tokens = fixtures[text];
          if (!tokens) throw new Error(`Missing tokenizer fixture for: ${text}`);
          return tokens;
        }
      }
    }
  );

  return {
    nativeFetch: vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" }
    })),
    env: {
      allowLocalModels: false,
      allowRemoteModels: true,
      useFS: true,
      useFSCache: true,
      useBrowserCache: true,
      useWasmCache: true,
      fetch: vi.fn(),
      localModelPath: "",
      backends: {
        onnx: {
          wasm: {
            wasmPaths: "" as string | { wasm: string },
            proxy: true,
            numThreads: 4
          }
        }
      }
    },
    classifier,
    pipeline: vi.fn(async () => classifier)
  };
});

vi.mock("@huggingface/transformers", () => transformers);

import { detectPersonCandidates, warmPersonDetector } from "./person-detector";

beforeEach(() => {
  globalThis.fetch = transformers.nativeFetch as unknown as typeof fetch;
  globalThis.chrome = {
    runtime: {
      getURL(path: string) {
        return `chrome-extension://accord-test/${path}`;
      }
    }
  } as typeof chrome;
});

test("configures Transformers.js to fetch packaged extension assets without filesystem fallbacks", async () => {
  await warmPersonDetector();

  expect(transformers.env).toMatchObject({
    allowLocalModels: true,
    allowRemoteModels: false,
    useFS: false,
    useFSCache: false,
    useBrowserCache: false,
    useWasmCache: false,
    localModelPath: "chrome-extension://accord-test/models/"
  });
  expect(transformers.env.backends.onnx.wasm).toMatchObject({
    wasmPaths: {
      wasm: "chrome-extension://accord-test/ort/ort-wasm-simd-threaded.asyncify.wasm"
    },
    proxy: false,
    numThreads: 1
  });
  expect(typeof transformers.env.fetch).toBe("function");

  const result = await detectPersonCandidates("Notify Jean-Pierre");
  expect(transformers.classifier).toHaveBeenCalledWith("Notify Jean-Pierre", {
    ignore_labels: [],
    aggregation_strategy: "none"
  });
  expect(result.candidates).toEqual([
    expect.objectContaining({
      type: "PERSON",
      originalText: "Jean-Pierre",
      start: 7,
      end: 18,
      detector: "accord_ner_v0_3_1"
    })
  ]);
  expect(result.coverage).toMatchObject({
    nerStatus: "ready",
    candidateCount: 1,
    detector: "accord_ner_v0_3_1",
    model: {
      name: "accord-ner-v0.3.1"
    }
  });
});
