import { defineConfig } from "wxt";
import { readFileSync } from "node:fs";

const extensionIdentity = JSON.parse(
  readFileSync(new URL("./config/extension-identity.json", import.meta.url), "utf8")
) as {
  chromeManifestKey: string;
};

export default defineConfig({
  // The MV3 background worker includes Supabase and the local inference runtime.
  // Do not run the production worker through Oxc minification: that path can
  // emit a bundle Chrome rejects before the auth/message listeners register.
  // The packaged inference libraries are already optimized upstream.
  vite: () => ({
    build: {
      minify: false
    }
  }),
  manifest: {
    name: "Accord Guard",
    short_name: "Accord Guard",
    description: "Accord governance inside ChatGPT. Detected identifiers are removed before governed message submission.",
    minimum_chrome_version: "114",
    key: extensionIdentity.chromeManifestKey,
    icons: {
      "16": "icons/accord-icon-16.png",
      "32": "icons/accord-icon-32.png",
      "48": "icons/accord-icon-48.png",
      "128": "icons/accord-icon-128.png"
    },
    permissions: ["storage", "identity", "sidePanel"],
    host_permissions: [
      "https://chatgpt.com/*",
      "https://www.accordgovernance.com/*",
      "https://*.supabase.co/*",
      "http://127.0.0.1:3000/*",
      "http://localhost:3000/*"
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
    },
    action: {
      default_title: "Accord Guard",
      default_icon: {
        "16": "icons/accord-icon-16.png",
        "32": "icons/accord-icon-32.png",
        "48": "icons/accord-icon-48.png",
        "128": "icons/accord-icon-128.png"
      }
    }
  }
});
