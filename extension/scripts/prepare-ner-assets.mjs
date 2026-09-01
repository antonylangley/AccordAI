import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareOrtAssets } from "./prepare-ort-assets.mjs";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(extensionRoot, "..");
const productionModelId = "accord-ner-v0.3.1";
const expectedModelSha256 = "89f4cbeedf5ff9d7513ed740ea4027c90ac2b3c14a05a2484748be09ce9fd354";
const requiredModelFiles = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "vocab.txt"
];

const modelSourceRoot = resolve(
  repoRoot,
  `ml/accord-ner/models/${productionModelId}/browser/${productionModelId}`
);

const modelsDestinationRoot = resolve(extensionRoot, "public/models");
const modelDestination = resolve(modelsDestinationRoot, productionModelId);

const sourceModelPath = join(modelSourceRoot, "onnx/model_quantized.onnx");
const browserModelPath = join(modelDestination, "onnx/model_quantized.onnx");

await assertDirectory(modelSourceRoot, "browser-qualified production model");
await assertFileHash(sourceModelPath, expectedModelSha256);

// Public assets are copied verbatim into the extension package. Recreate the
// packaging root so historical model directories cannot leak into production.
await rm(modelsDestinationRoot, { recursive: true, force: true });
await mkdir(join(modelDestination, "onnx"), { recursive: true });

for (const file of requiredModelFiles) {
  await cp(join(modelSourceRoot, file), join(modelDestination, file));
}

await cp(sourceModelPath, browserModelPath);
await assertFileHash(browserModelPath, expectedModelSha256);

const ortAssets = await prepareOrtAssets({ extensionRoot, repoRoot });

const modelStats = await stat(browserModelPath);

console.log(
  `Prepared Accord NER browser model: ${(modelStats.size / 1024 / 1024).toFixed(1)} MiB`
);
console.log(`Copied ${ortAssets.files.length} ONNX Runtime asset(s).`);
console.log(`Model assets: ${modelDestination}`);
console.log(`Browser ONNX: ${browserModelPath}`);
console.log(`WASM assets:  ${ortAssets.destination}`);

async function assertDirectory(path, label) {
  if (!(await isDirectory(path))) {
    throw new Error(`Missing ${label}: ${path}`);
  }
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function assertFileHash(path, expectedSha256) {
  const digest = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

  if (digest !== expectedSha256) {
    throw new Error(
      `Unexpected SHA-256 for ${path}: expected ${expectedSha256}, received ${digest}`
    );
  }
}
