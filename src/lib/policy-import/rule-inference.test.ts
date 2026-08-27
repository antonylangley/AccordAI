import { describe, expect, test } from "vitest";
import { canApprovePolicyRuleControl, canPublishPolicyRuleControl, isCandidateEnforcementControl } from "./enforceability";
import { inferPolicyRulesFromText } from "./rule-inference";

function inferOne(sourceText: string) {
  const result = inferPolicyRulesFromText(sourceText, "external-ai-policy.md");
  expect(result.rules.length).toBeGreaterThan(0);
  return result.rules[0];
}

describe("policy document rule inference", () => {
  test("keeps AI accuracy requirements as policy guidance", () => {
    const sourceText = "AI-generated information must not be assumed to be accurate.";
    const rule = inferOne(sourceText);

    expect(rule.sourceText).toBe(sourceText);
    expect(rule.supportingExcerpt).toBe(sourceText);
    expect(rule.controlType).toBe("output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
    expect(rule.reasoning).toContain("Converting it into prompt blocking would change the policy meaning.");
    expect(isCandidateEnforcementControl(rule)).toBe(false);
  });

  test("does not convert AI output-use limits into medical or legal prompt blocks", () => {
    const sourceText =
      "AI-generated content must not be used as the sole basis for a clinical diagnosis, treatment recommendation, employment decision, legal determination, or other high-impact decision.";
    const rule = inferOne(sourceText);

    expect(rule.sourceText).toBe(sourceText);
    expect(rule.controlType).toBe("output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
    expect(rule.dataCategories).toContain("high_impact_decision");
    expect(rule.dataCategories).not.toContain("medical_context");
    expect(rule.dataCategories).not.toContain("legal_context");
    expect(rule.employeeExplanation).toContain("governs how AI output is used");
  });

  test("does not allow guidance-only requirements to become published blocking controls automatically", () => {
    const rule = inferOne("AI-generated information must not be assumed to be accurate.");

    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.action).not.toBe("block");
    expect(rule.action).not.toBe("transform");
    expect(canApprovePolicyRuleControl(rule)).toBe(false);
    expect(canPublishPolicyRuleControl(rule)).toBe(false);
  });

  test("preserves category-specific destination authorization conditions", () => {
    const sourceText =
      "Confidential company information must not be submitted to external generative AI services unless the service has been specifically approved to process that category of information.";
    const rule = inferOne(sourceText);

    expect(rule.sourceText).toBe(sourceText);
    expect(rule.controlType).toBe("destination_restriction");
    expect(rule.enforceability).toBe("partially_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.action).toBe("block");
    expect(rule.dataCategories).toContain("confidential_company_data");
    expect(rule.destinationTypes).toContain("unapproved");
    expect(rule.conditionDescription).toContain("not approved for confidential company data");
    expect(rule.reasoning).toContain("must not become a blanket block");
    expect(rule.destinationAuthorizations).toEqual([
      {
        provider: "any",
        destinationType: "approved",
        dataCategories: ["confidential_company_data"],
        condition: "unless the service has been specifically approved to process that category of information."
      }
    ]);
  });

  test("prefers deterministic PHI category controls over vague medical context blocks", () => {
    const rule = inferOne("PHI must not be submitted to public AI services.");

    expect(rule.controlType).toBe("destination_restriction");
    expect(rule.enforceability).toBe("fully_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.action).toBe("block");
    expect(rule.dataCategories).toContain("phi");
    expect(rule.dataCategories).not.toContain("medical_context");
    expect(rule.destinationTypes).toContain("personal");
  });
});
