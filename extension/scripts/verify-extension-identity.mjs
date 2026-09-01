import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const identity = JSON.parse(readFileSync(new URL("../config/extension-identity.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../.output/chrome-mv3/manifest.json", import.meta.url), "utf8"));

const expectedId = deriveChromeExtensionId(identity.chromeManifestKey);

if (manifest.key !== identity.chromeManifestKey) {
  throw new Error("Generated manifest is missing the stable Accord Guard Chrome manifest key.");
}

if (identity.chromeExtensionId !== expectedId) {
  throw new Error(`Stable extension identity mismatch: expected ${expectedId}, found ${identity.chromeExtensionId}.`);
}

const expectedRedirectUrl = `https://${identity.chromeExtensionId}.chromiumapp.org/${identity.oauthCallbackPath}`;
if (identity.oauthRedirectUrl !== expectedRedirectUrl) {
  throw new Error(`Stable OAuth redirect mismatch: expected ${expectedRedirectUrl}, found ${identity.oauthRedirectUrl}.`);
}

if (!manifest.permissions?.includes("identity")) {
  throw new Error("Generated manifest must keep the chrome.identity permission for Accord Guard OAuth.");
}

console.log(`Accord Guard stable Chrome extension ID verified: ${identity.chromeExtensionId}`);
console.log(`Accord Guard OAuth redirect URL: ${identity.oauthRedirectUrl}`);

function deriveChromeExtensionId(manifestKey) {
  const publicKeyDer = Buffer.from(manifestKey, "base64");
  const idHex = createHash("sha256").update(publicKeyDer).digest("hex").slice(0, 32);
  return idHex.replace(/[0-9a-f]/g, (char) => String.fromCharCode("a".charCodeAt(0) + Number.parseInt(char, 16)));
}
