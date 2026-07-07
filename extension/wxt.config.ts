import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Accord Guard",
    short_name: "Accord Guard",
    description: "Accord governance inside ChatGPT. Detected identifiers are removed before governed message submission.",
    permissions: ["storage"],
    host_permissions: ["https://chatgpt.com/*"],
    action: {
      default_title: "Accord Guard"
    }
  }
});
