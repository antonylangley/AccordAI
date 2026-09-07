import {
  BUILT_IN_POLICY_BUNDLES,
  DEFAULT_APPROVED_AI_PROVIDERS,
  evaluatePolicySet
} from "@accord/governance-core";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

type OodCase = { text: string; ruleId: string };
const fixturePath = fileURLToPath(new URL("../../../ml/policy-eval/accord-private-context-ood-v1.json", import.meta.url));

describe("frozen private-context OOD regression", () => {
  test("semantic retrieval requires and accepts composed deterministic evidence", async () => {
    const rows = JSON.parse(await readFile(fixturePath, "utf8")) as OodCase[];
    const rules = BUILT_IN_POLICY_BUNDLES.flatMap((bundle) => bundle.rules);
    const decisions = rows.map(({ text, ruleId }) =>
      evaluatePolicySet(rules, {
        text,
        detectors: [],
        context: {
          provider: "chatgpt",
          app: "chatgpt",
          approvedProviders: DEFAULT_APPROVED_AI_PROVIDERS,
          contentType: "prompt"
        },
        redactionAvailable: false,
        semanticSignals: [{ ruleId, positiveScore: 0.82, negativeScore: 0.11, adjustedScore: 0.82, rank: 1 }]
      })
    );
    const misses = rows
      .map((row, index) => ({ ...row, action: decisions[index].action, concepts: decisions[index].detectedConcepts }))
      .filter((row) => !["HOLD", "BLOCK"].includes(row.action));
    expect(misses, JSON.stringify(misses)).toEqual([]);
  });

  test.each([
    "What does leadership usually consider before approving a rollout?",
    "How do companies budget for opening new locations?",
    "Create a fictional rollout and budget for a made-up company.",
    "What does an annual operating budget normally contain?"
  ])("keeps a private-context OOD safe control allowed: %s", (text) => {
    const rules = BUILT_IN_POLICY_BUNDLES.flatMap((bundle) => bundle.rules);
    const targetRuleIds = [
      "accord.confidential.strategy-pricing-contracts",
      "accord.confidential.board-security-technical"
    ];
    const decision = evaluatePolicySet(rules, {
      text,
      detectors: [],
      context: {
        provider: "chatgpt",
        app: "chatgpt",
        approvedProviders: DEFAULT_APPROVED_AI_PROVIDERS,
        contentType: "prompt"
      },
      redactionAvailable: false,
      semanticSignals: targetRuleIds.map((ruleId, index) => ({
        ruleId,
        positiveScore: 0.82 - index * 0.01,
        negativeScore: 0.11,
        adjustedScore: 0.82 - index * 0.01,
        rank: index + 1
      }))
    });

    expect(decision).toMatchObject({ triggered: false, action: "ALLOW" });
  });
});
