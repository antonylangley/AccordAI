import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const sidebarSource = readFileSync(fileURLToPath(new URL("./sidebar.tsx", import.meta.url)), "utf8");
const chatNavSource = readFileSync(fileURLToPath(new URL("./chat-hover-nav.tsx", import.meta.url)), "utf8");

describe("sidebar interaction", () => {
  test("mouse clicks do not keep navigation expanded after hover ends", () => {
    expect(sidebarSource).not.toContain("group-focus-within/sidebar");
    expect(chatNavSource).not.toContain("group-focus-within:");
  });

  test("keyboard-visible focus still expands navigation", () => {
    expect(sidebarSource).toContain("group-has-[:focus-visible]/sidebar:w-52");
    expect(chatNavSource).toContain("group-has-[:focus-visible]:opacity-100");
  });
});
