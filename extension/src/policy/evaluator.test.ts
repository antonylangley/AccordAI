import { describe, expect, test } from "vitest";
import {
  BUILT_IN_POLICY_BUNDLES,
  DEFAULT_APPROVED_AI_PROVIDERS,
  POLICY_SCHEMA_VERSION,
  builtInRulesForSelection
} from "@accord/governance-core";
import { evaluatePolicyBundle } from "./evaluator";
import type { PublishedPolicyBundle } from "./types";

describe("policy bundle evaluator", () => {
  test("leaves safe prompts untouched", () => {
    const decision = evaluatePolicyBundle(testBundle(), signals({}, "Explain canine pancreatitis."), {
      provider: "chatgpt",
      app: "chatgpt",
      contentType: "prompt"
    });

    expect(decision.triggered).toBe(false);
    expect(decision.executionAction).toBe("allow");
  });

  test("transforms removable client identifiers for personal ChatGPT", () => {
    const decision = evaluatePolicyBundle(
      testBundle(),
      signals({
        entityCounts: { PERSON: 1, ADDRESS: 1 },
        redactionCount: 2,
        sanitizedTextAvailable: true
      }),
      {
        provider: "chatgpt",
        app: "chatgpt",
        contentType: "prompt"
      }
    );

    expect(decision.triggered).toBe(true);
    expect(decision.executionAction).toBe("redact");
    expect(decision.policyAction).toBe("REDACT");
    expect(decision.rule?.source.type).toBe("accord_builtin");
  });

  test("uses blocking fallback only when transform cannot safely sanitize", () => {
    const decision = evaluatePolicyBundle(
      testBundle(),
      signals({
        flags: [{ type: "address", label: "Address", severity: "medium", stage: "preflight", evidence: "test" }],
        redactionCount: 0,
        sanitizedTextAvailable: false
      }),
      {
        provider: "chatgpt",
        app: "chatgpt",
        contentType: "prompt"
      }
    );

    expect(decision.executionAction).toBe("block");
    expect(decision.policyAction).toBe("HOLD");
  });

  test("approved enterprise AI without restricted data is allowed", () => {
    const decision = evaluatePolicyBundle(
      testBundle(),
      signals({
        flags: [{ type: "regulated_financial", label: "Regulated financial context", severity: "high", stage: "preflight", evidence: "test" }]
      }, "Summarize a publicly released earnings report."),
      {
        provider: "copilot-enterprise",
        app: "copilot",
        contentType: "prompt"
      }
    );

    expect(decision.triggered).toBe(false);
    expect(decision.executionAction).toBe("allow");
  });

  test("rule precedence favors block over transform", () => {
    const bundle = testBundle({
      rules: [
        testBundle().rules[0],
        {
          ...testBundle().rules[0],
          id: "rule_block",
          title: "Block personal data",
          action: "BLOCK",
          severity: "CRITICAL",
          source: {
            type: "organization_policy",
            documentName: "AI Acceptable Use Policy",
            section: "4.2"
          }
        }
      ]
    });
    const decision = evaluatePolicyBundle(
      bundle,
      signals({
        entityCounts: { PERSON: 1 },
        redactionCount: 1,
        sanitizedTextAvailable: true
      }),
      {
        provider: "chatgpt",
        app: "chatgpt",
        contentType: "prompt"
      }
    );

    expect(decision.executionAction).toBe("block");
    expect(decision.rule?.id).toBe("rule_block");
  });

  test("applies the same built-in detector rules to supported attachment text", () => {
    const decision = evaluatePolicyBundle(
      testBundle(),
      signals(
        {
          entityCounts: { PERSON: 1, EMAIL: 1 },
          redactionCount: 2,
          sanitizedTextAvailable: true
        },
        "Veterinary discharge notes for the client are attached."
      ),
      {
        provider: "chatgpt",
        app: "chatgpt",
        contentType: "attachment"
      }
    );

    expect(decision.executionAction).toBe("redact");
    expect(decision.rule?.category).toBe("CLIENT_VETERINARY_DATA");
  });
});

function testBundle(overrides: Partial<PublishedPolicyBundle> = {}): PublishedPolicyBundle {
  const enabledBuiltInBundleIds = BUILT_IN_POLICY_BUNDLES.filter((bundle) => bundle.defaultEnabled).map((bundle) => bundle.id);
  const rules = builtInRulesForSelection(enabledBuiltInBundleIds);
  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: "bundle_test_1",
    companySlug: "test-company",
    version: 1,
    status: "published",
    checksum: "checksum",
    ruleCount: rules.length,
    publishedAt: "2026-07-28T00:00:00.000Z",
    enabledBuiltInBundleIds,
    approvedProviders: DEFAULT_APPROVED_AI_PROVIDERS,
    rules,
    ...overrides
  };
}

function signals(overrides: Partial<Parameters<typeof evaluatePolicyBundle>[1]>, text = "Review this veterinary client record."): Parameters<typeof evaluatePolicyBundle>[1] {
  return {
    text,
    flags: [],
    entityCounts: {},
    riskScore: 10,
    redactionCount: 0,
    sanitizedTextAvailable: false,
    ...overrides
  };
}
