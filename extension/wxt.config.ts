import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Accord Guard",
    short_name: "Accord Guard",
    description: "Accord governance inside ChatGPT. Detected identifiers are removed before governed message submission.",
    icons: {
      "16": "icons/accord-icon-16.png",
      "32": "icons/accord-icon-32.png",
      "48": "icons/accord-icon-48.png",
      "128": "icons/accord-icon-128.png"
    },
    permissions: ["storage"],
    host_permissions: ["https://chatgpt.com/*"],
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
