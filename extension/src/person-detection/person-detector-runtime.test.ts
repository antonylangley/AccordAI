import { beforeEach, expect, test, vi } from "vitest";

const transformers = vi.hoisted(() => ({
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
  pipeline: vi.fn(async () => vi.fn())
}));

vi.mock("@huggingface/transformers", () => transformers);

import { warmPersonDetector } from "./person-detector";

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
  expect(transformers.nativeFetch).toHaveBeenCalledWith(
    "chrome-extension://accord-test/models/accord-ner-v0.2/config.json"
  );
  expect(transformers.nativeFetch).toHaveBeenCalledWith(
    "chrome-extension://accord-test/models/accord-ner-v0.2/tokenizer.json"
  );
  expect(transformers.nativeFetch).toHaveBeenCalledWith(
    "chrome-extension://accord-test/ort/ort-wasm-simd-threaded.asyncify.wasm"
  );
});
