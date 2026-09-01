import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultExtensionRoot = resolve(dirname(scriptPath), "..");
const defaultRepoRoot = resolve(defaultExtensionRoot, "..");

export const requiredOrtFiles = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm"
];

export async function prepareOrtAssets({
  extensionRoot = defaultExtensionRoot,
  repoRoot = defaultRepoRoot
} = {}) {
  const ortDist = await findOrtDist(extensionRoot, repoRoot);
  const wasmDestination = resolve(extensionRoot, "public/ort");

  await rm(wasmDestination, { recursive: true, force: true });
  await mkdir(wasmDestination, { recursive: true });

  for (const file of requiredOrtFiles) {
    const source = join(ortDist, file);
    await assertFile(source, `ONNX Runtime asset ${file}`);
    await cp(source, join(wasmDestination, file));
  }

  return {
    files: requiredOrtFiles,
    destination: wasmDestination
  };
}

async function findOrtDist(extensionRoot, repoRoot) {
  const direct = resolve(
    extensionRoot,
    "node_modules/onnxruntime-web/dist"
  );

  if (await isDirectory(direct)) return direct;

  const pnpmRoot = resolve(repoRoot, "node_modules/.pnpm");

  if (await isDirectory(pnpmRoot)) {
    const entries = await readdir(pnpmRoot, {
      withFileTypes: true
    });

    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        !entry.name.startsWith("onnxruntime-web@")
      ) {
        continue;
      }

      const candidate = resolve(
        pnpmRoot,
        entry.name,
        "node_modules/onnxruntime-web/dist"
      );

      if (await isDirectory(candidate)) return candidate;
    }
  }

  throw new Error(
    "Could not locate onnxruntime-web/dist. Run npm install or pnpm install from the repo root first."
  );
}

async function assertFile(path, label) {
  try {
    if ((await stat(path)).isFile()) return;
  } catch {
    // Fall through to the shared error below.
  }

  throw new Error(`Missing ${label}: ${path}`);
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const result = await prepareOrtAssets();
  console.log(`Copied ${result.files.length} ONNX Runtime asset(s).`);
  console.log(`WASM assets:  ${result.destination}`);
}
