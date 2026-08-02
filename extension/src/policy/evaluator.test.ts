import { describe, expect, test } from "vitest";
import { evaluatePolicyBundle } from "./evaluator";
import type { PublishedPolicyBundle } from "./types";

describe("policy bundle evaluator", () => {
  test("leaves safe prompts untouched", () => {
    const decision = evaluatePolicyBundle(testBundle(), signals({}), {
      aiProvider: "chatgpt",
      destinationType: "personal",
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
        aiProvider: "chatgpt",
        destinationType: "personal",
        contentType: "prompt"
      }
    );

    expect(decision.triggered).toBe(true);
    expect(decision.executionAction).toBe("redact");
    expect(decision.policyAction).toBe("transform");
    expect(decision.rule?.sourceSection).toBe("4.2 - Client Information");
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
        aiProvider: "chatgpt",
        destinationType: "personal",
        contentType: "prompt"
      }
    );

    expect(decision.executionAction).toBe("block");
    expect(decision.fallbackAction).toBe("block");
  });

  test("approved enterprise AI without restricted data is allowed", () => {
    const decision = evaluatePolicyBundle(
      testBundle(),
      signals({
        flags: [{ type: "regulated_financial", label: "Regulated financial context", severity: "high", stage: "preflight", evidence: "test" }]
      }),
      {
        aiProvider: "chatgpt",
        destinationType: "enterprise",
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
          ruleKey: "block_personal_data",
          action: "block",
          severity: "critical"
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
        aiProvider: "chatgpt",
        destinationType: "personal",
        contentType: "prompt"
      }
    );

    expect(decision.executionAction).toBe("block");
    expect(decision.rule?.ruleKey).toBe("block_personal_data");
  });
});

function testBundle(overrides: Partial<PublishedPolicyBundle> = {}): PublishedPolicyBundle {
  return {
    id: "bundle_test_1",
    companySlug: "test-company",
    version: 1,
    status: "published",
    checksum: "checksum",
    ruleCount: 1,
    publishedAt: "2026-07-28T00:00:00.000Z",
    rules: [
      {
        id: "rule_external_ai_client_info_v1",
        ruleKey: "external_ai_client_info",
        version: 1,
        name: "Do not submit client identifiers to personal AI",
        sourcePolicyName: "External AI Usage Policy",
        sourceSection: "4.2 - Client Information",
        supportingExcerpt: "Employees must not submit client identifiers to personal AI.",
        dataCategories: ["client_identifying_info", "personal_data", "address", "account"],
        userScope: "all",
        departmentScope: "all",
        aiProvider: "chatgpt",
        destinationType: "personal",
        action: "transform",
        fallbackAction: "block",
        severity: "high",
        employeeExplanation: "Client identifiers must be removed before submission.",
        effectiveDate: "2026-07-28"
      }
    ],
    ...overrides
  };
}

function signals(overrides: Partial<Parameters<typeof evaluatePolicyBundle>[1]>): Parameters<typeof evaluatePolicyBundle>[1] {
  return {
    flags: [],
    entityCounts: {},
    riskScore: 10,
    redactionCount: 0,
    sanitizedTextAvailable: false,
    ...overrides
  };
}
