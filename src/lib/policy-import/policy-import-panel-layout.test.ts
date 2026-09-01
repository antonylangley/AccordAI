import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const panelSource = readFileSync(
  fileURLToPath(new URL("../../app/(app)/policies/policy-import-panel.tsx", import.meta.url)),
  "utf8"
);

describe("policy import panel layout guardrails", () => {
  test("renders generated review results outside the dashed upload surface", () => {
    expect(panelSource).toContain('<section className="space-y-4">');
    expect(panelSource).toContain('data-layout-role="policy-import-upload"');
    expect(panelSource).toContain('data-layout-role="policy-import-review"');

    const uploadIndex = panelSource.indexOf('data-layout-role="policy-import-upload"');
    const reviewIndex = panelSource.indexOf('data-layout-role="policy-import-review"');
    expect(uploadIndex).toBeGreaterThan(-1);
    expect(reviewIndex).toBeGreaterThan(uploadIndex);
  });

  test("keeps the save footer in normal document flow", () => {
    const footerIndex = panelSource.indexOf('data-layout-role="policy-import-save-footer"');
    expect(footerIndex).toBeGreaterThan(-1);

    const footerSource = panelSource.slice(footerIndex, footerIndex + 600);
    expect(footerSource).not.toMatch(/\b(sticky|fixed|absolute|bottom-\d|h-screen|min-h-screen|h-dvh|100vh|100dvh)\b/);
  });
});
