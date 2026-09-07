import { beforeEach, expect, test, vi } from "vitest";

const transformers = vi.hoisted(() => ({
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
  pipeline: vi.fn()
}));

vi.mock("@huggingface/transformers", () => transformers);

import { configurePolicyEmbeddingRuntime } from "./embedding-runtime";

beforeEach(() => {
  globalThis.chrome = {
    runtime: {
      getURL(path: string) {
        return `chrome-extension://accord-test/${path}`;
      }
    }
  } as typeof chrome;
});

test("configures the policy embedding runtime for local packaged assets only", () => {
  configurePolicyEmbeddingRuntime();

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
});
