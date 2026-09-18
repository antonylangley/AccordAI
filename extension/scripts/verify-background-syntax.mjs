import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const backgroundPath = new URL("../.output/chrome-mv3/background.js", import.meta.url);
const source = readFileSync(backgroundPath, "utf8");

new Script(`"use strict";\n${source}`, { filename: "background.js" });
console.log("Accord Guard background service worker strict syntax verified.");
