import {
  DEFAULT_APPROVED_AI_PROVIDERS,
  DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS,
  builtInRulesForSelection,
  evaluatePolicySet,
  retrievePolicyCandidates,
  type PolicyDetectorSignal,
  type PolicyEvaluationInput
} from "@accord/governance-core";
import { describe, expect, test } from "vitest";
import { ACCORD_POLICY_BENCHMARK_V1 } from "../../../ml/policy-eval/accord-policy-benchmark-v1";

describe("frozen Accord policy benchmark v1", () => {
  test("contains 80 synthetic rows", () => {
    expect(ACCORD_POLICY_BENCHMARK_V1).toHaveLength(80);
  });

  test("reports reusable retrieval and decision metrics", () => {
    const rules = builtInRulesForSelection(DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS);
    let correctDecision = 0;
    let correctAction = 0;
    let correctProviderScope = 0;
    let providerRows = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let semanticCorrect = 0;
    let semanticExpected = 0;
    let semanticObserved = 0;
    let semanticTruePositive = 0;
    const mismatches: string[] = [];

    for (const row of ACCORD_POLICY_BENCHMARK_V1) {
      const input: PolicyEvaluationInput = {
        text: row.text,
        detectors: row.detectors as PolicyDetectorSignal[],
        context: {
          provider: row.provider,
          app: row.provider.startsWith("copilot") ? "copilot" : "chatgpt",
          approvedProviders: DEFAULT_APPROVED_AI_PROVIDERS,
          contentType: "prompt"
        },
        redactionAvailable: row.redactionAvailable
      };
      const candidates = retrievePolicyCandidates(rules, input);
      const decision = evaluatePolicySet(rules, input);
      const semanticRetrieved = candidates.some((candidate) => candidate.reasons.some((reason) => reason.type === "semantic_example"));

      if (decision.triggered === row.expectedTriggered) correctDecision += 1;
      else {
        if (decision.triggered) falsePositives += 1;
        else falseNegatives += 1;
      }
      if (decision.action === row.expectedAction) correctAction += 1;
      if (row.providerContrast) {
        providerRows += 1;
        if (decision.action === row.expectedAction) correctProviderScope += 1;
      }
      if (semanticRetrieved === row.semanticShouldRetrieve) semanticCorrect += 1;
      if (row.semanticShouldRetrieve) semanticExpected += 1;
      if (semanticRetrieved) semanticObserved += 1;
      if (row.semanticShouldRetrieve && semanticRetrieved) semanticTruePositive += 1;

      if (
        decision.triggered !== row.expectedTriggered ||
        decision.action !== row.expectedAction ||
        (row.expectedSource && decision.source !== row.expectedSource) ||
        (row.expectedPrimaryRuleId && decision.primaryRule?.id !== row.expectedPrimaryRuleId)
      ) {
        mismatches.push(`${row.id}:${decision.primaryRule?.id || "none"}:${decision.action}`);
      }
    }

    const expectedNegative = ACCORD_POLICY_BENCHMARK_V1.filter((row) => !row.expectedTriggered).length;
    const expectedPositive = ACCORD_POLICY_BENCHMARK_V1.length - expectedNegative;
    const metrics = {
      rows: ACCORD_POLICY_BENCHMARK_V1.length,
      retrievalAccuracy: semanticCorrect / ACCORD_POLICY_BENCHMARK_V1.length,
      semanticPrecision: semanticObserved ? semanticTruePositive / semanticObserved : 1,
      semanticRecall: semanticExpected ? semanticTruePositive / semanticExpected : 1,
      decisionAccuracy: correctDecision / ACCORD_POLICY_BENCHMARK_V1.length,
      actionAccuracy: correctAction / ACCORD_POLICY_BENCHMARK_V1.length,
      falsePositiveRate: expectedNegative ? falsePositives / expectedNegative : 0,
      falseNegativeRate: expectedPositive ? falseNegatives / expectedPositive : 0,
      providerScopeAccuracy: providerRows ? correctProviderScope / providerRows : 1,
      mismatches
    };

    console.info("[Accord policy benchmark v1]", metrics);
    expect(metrics.decisionAccuracy).toBeGreaterThanOrEqual(0.95);
    expect(metrics.actionAccuracy).toBeGreaterThanOrEqual(0.95);
    expect(metrics.falsePositiveRate).toBe(0);
    expect(metrics.falseNegativeRate).toBeLessThanOrEqual(0.05);
    expect(metrics.providerScopeAccuracy).toBe(1);
  });
});
