import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(extensionRoot, "..");

const bestModelRoot = resolve(repoRoot, "ml/accord-ner/models/accord-ner-v0.1/best");
const onnxExportRoot = resolve(repoRoot, "ml/accord-ner/models/accord-ner-v0.1/onnx");
const modelDestination = resolve(extensionRoot, "public/models/accord-ner-v0.1");
const wasmDestination = resolve(extensionRoot, "public/ort");

await assertDirectory(bestModelRoot, "trained model checkpoint");
await assertDirectory(onnxExportRoot, "ONNX export");

await rm(modelDestination, { recursive: true, force: true });
await mkdir(join(modelDestination, "onnx"), { recursive: true });

const bestFiles = await readdir(bestModelRoot, { withFileTypes: true });
for (const entry of bestFiles) {
  if (!entry.isFile() || !isTokenizerOrConfig(entry.name)) continue;
  await cp(join(bestModelRoot, entry.name), join(modelDestination, entry.name));
}

const onnxFiles = await findFiles(
  onnxExportRoot,
  (name) => name.endsWith(".onnx") || name.endsWith(".onnx_data")
);
const modelOnnx =
  onnxFiles.find((path) => basename(path) === "model.onnx") ??
  onnxFiles.find((path) => path.endsWith(".onnx"));

if (!modelOnnx) {
  throw new Error(`No ONNX model found under ${onnxExportRoot}`);
}

await cp(modelOnnx, join(modelDestination, "onnx/model.onnx"));

for (const source of onnxFiles.filter((path) => path.endsWith(".onnx_data"))) {
  await cp(source, join(modelDestination, "onnx", basename(source)));
}

const ortDist = await findOrtDist();
const wasmFiles = (await readdir(ortDist)).filter((name) => name.endsWith(".wasm"));

if (!wasmFiles.length) {
  throw new Error(`No ONNX Runtime WASM files found in ${ortDist}`);
}

await rm(wasmDestination, { recursive: true, force: true });
await mkdir(wasmDestination, { recursive: true });

for (const file of wasmFiles) {
  await cp(join(ortDist, file), join(wasmDestination, file));
}

const modelStats = await stat(join(modelDestination, "onnx/model.onnx"));

console.log(
  `Prepared Accord NER browser model: ${(modelStats.size / 1024 / 1024).toFixed(1)} MiB`
);
console.log(`Copied ${wasmFiles.length} ONNX Runtime WASM asset(s).`);
console.log(`Model assets: ${modelDestination}`);
console.log(`WASM assets:  ${wasmDestination}`);

function isTokenizerOrConfig(name) {
  return [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "vocab.txt"
  ].includes(name);
}

async function findOrtDist() {
  const direct = resolve(extensionRoot, "node_modules/onnxruntime-web/dist");
  if (await isDirectory(direct)) return direct;

  const pnpmRoot = resolve(repoRoot, "node_modules/.pnpm");
  if (await isDirectory(pnpmRoot)) {
    const entries = await readdir(pnpmRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("onnxruntime-web@")) continue;

      const candidate = resolve(
        pnpmRoot,
        entry.name,
        "node_modules/onnxruntime-web/dist"
      );

      if (await isDirectory(candidate)) return candidate;
    }
  }

  throw new Error(
    "Could not locate onnxruntime-web/dist. Run pnpm install from the repo root first."
  );
}

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

async function findFiles(root, predicate) {
  const found = [];
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      found.push(...(await findFiles(path, predicate)));
    } else if (entry.isFile() && predicate(entry.name)) {
      found.push(path);
    }
  }

  return found;
}
