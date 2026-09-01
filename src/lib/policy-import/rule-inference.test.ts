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
    expect(rule.requirementDirection).toBe("ai_output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
    expect(rule.dataCategories).toEqual([]);
    expect(rule.dataCategories).not.toContain("ai_usage_policy");
    expect(rule.reasoning).toContain("Converting it into prompt blocking would change the policy meaning.");
    expect(isCandidateEnforcementControl(rule)).toBe(false);
  });

  test("does not convert AI output-use limits into medical or legal prompt blocks", () => {
    const sourceText =
      "AI-generated content must not be used as the sole basis for a clinical diagnosis, treatment recommendation, employment decision, legal determination, or other high-impact decision.";
    const rule = inferOne(sourceText);

    expect(rule.sourceText).toBe(sourceText);
    expect(rule.controlType).toBe("output_usage");
    expect(rule.requirementDirection).toBe("ai_output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
    expect(rule.dataCategories).toContain("high_impact_decision");
    expect(rule.dataCategories).not.toContain("medical_context");
    expect(rule.dataCategories).not.toContain("legal_context");
    expect(rule.employeeExplanation).toContain("governs how AI output is used");
  });

  test("classifies fabricated AI citation representations as downstream output-use guidance", () => {
    const sourceText = "Employees must not represent fabricated AI-generated citations as verified sources.";
    const rule = inferOne(sourceText);

    expect(rule.sourceText).toBe(sourceText);
    expect(rule.controlType).toBe("output_usage");
    expect(rule.requirementDirection).toBe("ai_output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
    expect(rule.dataCategories).not.toContain("ai_usage_policy");
    expect(rule.reasoning).toContain("downstream use of AI output");
    expect(isCandidateEnforcementControl(rule)).toBe(false);
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
    expect(rule.requirementDirection).toBe("prompt_input");
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

  test("maps confidential information to category-specific destination authorization without blocking approved destinations as the violation", () => {
    const sourceText = "Confidential information may only be submitted to systems approved to process that category.";
    const rule = inferOne(sourceText);

    expect(rule.controlType).toBe("destination_restriction");
    expect(rule.enforceability).toBe("partially_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.action).toBe("block");
    expect(rule.dataCategories).toContain("confidential_company_data");
    expect(rule.destinationTypes).toContain("unapproved");
    expect(rule.destinationType).toBe("unapproved");
    expect(rule.conditionDescription).toContain("not approved for confidential company data");
    expect(rule.destinationAuthorizations[0]).toEqual({
      provider: "any",
      destinationType: "approved",
      dataCategories: ["confidential_company_data"],
      condition: "may only be submitted to systems approved to process that category."
    });
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

  test("maps patient information submitted to public AI as an enforceable input rule", () => {
    const rule = inferOne("Patient information must not be submitted to public AI systems.");

    expect(rule.controlType).toBe("destination_restriction");
    expect(rule.requirementDirection).toBe("prompt_input");
    expect(rule.enforceability).toBe("fully_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.action).toBe("block");
    expect(rule.dataCategories).toContain("patient_information");
    expect(rule.dataCategories).not.toContain("customer_data");
    expect(rule.destinationTypes).toContain("personal");
  });

  test("classifies API keys and passwords as enforceable security secret controls", () => {
    const rule = inferOne("Employees must never submit API keys or passwords to external AI services.");

    expect(rule.controlType).toBe("security_secret");
    expect(rule.enforceability).toBe("fully_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.action).toBe("block");
    expect(rule.severity).toBe("critical");
    expect(rule.dataCategories).toContain("api_keys");
    expect(rule.dataCategories).toContain("passwords");
  });

  test("maps client identifying information submitted to personal AI as an enforceable input-side restriction", () => {
    const rule = inferOne("Employees must not submit client identifying information to personal AI tools.");

    expect(rule.controlType).toBe("destination_restriction");
    expect(rule.requirementDirection).toBe("prompt_input");
    expect(rule.enforceability).toBe("fully_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.action).toBe("block");
    expect(rule.dataCategories).toContain("client_identifying_info");
    expect(rule.destinationTypes).toContain("personal");
  });

  test("maps credentials entered into unapproved AI systems as input-side security restriction", () => {
    const rule = inferOne("Credentials and secrets must never be entered into unapproved AI systems.");

    expect(rule.controlType).toBe("security_secret");
    expect(rule.requirementDirection).toBe("prompt_input");
    expect(rule.enforceability).toBe("fully_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.action).toBe("block");
    expect(rule.severity).toBe("critical");
    expect(rule.dataCategories).toContain("credentials");
    expect(rule.destinationTypes).toContain("unapproved");
  });

  test("keeps review-before-sharing output requirements as guidance", () => {
    const sourceText = "Employees must review AI-generated material before sending it to patients, customers, business partners, regulators, or the public.";
    const rule = inferOne(sourceText);

    expect(rule.controlType).toBe("output_usage");
    expect(rule.requirementDirection).toBe("ai_output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
    expect(rule.dataCategories).toContain("ai_output_review");
    expect(canPublishPolicyRuleControl(rule)).toBe(false);
  });

  test("maps customer records in approved AI systems to a conditional destination control", () => {
    const sourceText = "Customer records may only be processed using AI systems approved for customer data.";
    const rule = inferOne(sourceText);

    expect(rule.controlType).toBe("destination_restriction");
    expect(rule.enforceability).toBe("partially_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.dataCategories).toContain("customer_data");
    expect(rule.destinationTypes).toContain("unapproved");
    expect(rule.conditionDescription).toContain("not approved for customer data");
    expect(rule.destinationAuthorizations[0]?.dataCategories).toContain("customer_data");
  });

  test("does not classify source code and trade-secret IP as security credentials", () => {
    const sourceText =
      "Employees must not knowingly submit confidential source code, proprietary algorithms, unpublished research, trade secrets, or other protected intellectual property to an external AI service unless that service has been approved for such use.";
    const rule = inferOne(sourceText);

    expect(rule.controlType).toBe("intellectual_property");
    expect(rule.enforceability).toBe("partially_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.dataCategories).toContain("source_code");
    expect(rule.dataCategories).toContain("intellectual_property");
    expect(rule.dataCategories).toContain("trade_secrets");
    expect(rule.dataCategories).not.toContain("credentials");
    expect(rule.dataCategories).not.toContain("api_keys");
    expect(rule.dataCategories).not.toContain("passwords");
    expect(rule.destinationAuthorizations[0]?.condition).toContain("unless that service has been approved for such use");
  });

  test("keeps training requirements as non-enforceable procedural guidance", () => {
    const rule = inferOne("Employees must complete annual AI training before using generative AI for company work.");

    expect(rule.controlType).toBe("procedural");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
  });

  test("maps personal accounts and unapproved AI services to destination restrictions", () => {
    const sourceText =
      "Employees must not use personal accounts or unapproved generative AI services to perform company business or process company information.";
    const rule = inferOne(sourceText);

    expect(rule.controlType).toBe("destination_restriction");
    expect(rule.enforceability).toBe("partially_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.requirementDirection).toBe("ai_provider_usage");
    expect(rule.destinationTypes).toContain("personal");
    expect(rule.destinationTypes).toContain("unapproved");
    expect(rule.destinationType).toBe("unapproved");
    expect(rule.dataCategories).toContain("confidential_company_data");
  });

  test("maps unapproved AI service use to an observable destination restriction without fake data categories", () => {
    const rule = inferOne("Employees must not use unapproved AI services for company business.");

    expect(rule.controlType).toBe("destination_restriction");
    expect(rule.requirementDirection).toBe("ai_provider_usage");
    expect(rule.enforceability).toBe("partially_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.action).toBe("block");
    expect(rule.destinationTypes).toContain("unapproved");
    expect(rule.destinationType).toBe("unapproved");
    expect(rule.dataCategories).toEqual([]);
    expect(rule.dataCategories).not.toContain("ai_usage_policy");
    expect(rule.conditionDescription).toContain("use unapproved AI destinations");
  });

  test("keeps AI-generated marketing copy review as policy guidance", () => {
    const rule = inferOne("AI-generated marketing copy must be reviewed by Marketing before publication.");

    expect(rule.controlType).toBe("output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
  });

  test("keeps AI-generated marketing material review as human review policy guidance", () => {
    const rule = inferOne("AI-generated marketing material must be reviewed before publication.");

    expect(rule.controlType).toBe("output_usage");
    expect(rule.requirementDirection).toBe("ai_output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
    expect(rule.dataCategories).not.toContain("ai_usage_policy");
  });

  test("keeps AI-generated clinical recommendation review as output guidance", () => {
    const rule = inferOne("AI-generated clinical recommendations must be reviewed by a veterinarian before use.");

    expect(rule.controlType).toBe("output_usage");
    expect(rule.requirementDirection).toBe("ai_output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
  });

  test("keeps AI output disclosure requirements out of prompt blocking", () => {
    const rule = inferOne("AI-generated material must be clearly labeled before external publication.");

    expect(rule.controlType).toBe("output_usage");
    expect(rule.requirementDirection).toBe("ai_output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
    expect(rule.dataCategories).not.toContain("ai_usage_policy");
  });

  test("keeps machine-generated content identification as output governance", () => {
    const rule = inferOne("AI output must clearly identify when content is machine generated.");

    expect(rule.controlType).toBe("output_usage");
    expect(rule.requirementDirection).toBe("ai_output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
  });

  test("preserves approved-provider semantics for confidential material", () => {
    const rule = inferOne("Employees may only use organization-approved AI services for confidential material.");

    expect(rule.controlType).toBe("destination_restriction");
    expect(rule.requirementDirection).toBe("ai_provider_usage");
    expect(rule.enforceability).toBe("partially_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.action).toBe("block");
    expect(rule.dataCategories).toContain("confidential_company_data");
    expect(rule.destinationTypes).toContain("unapproved");
    expect(rule.destinationType).toBe("unapproved");
    expect(rule.conditionDescription).toContain("not approved for confidential company data");
  });

  test("safe general AI response guidance does not invent a hard block", () => {
    const rule = inferOne("Employees should verify AI responses before relying on them.");

    expect(rule.controlType).toBe("output_usage");
    expect(rule.requirementDirection).toBe("ai_output_usage");
    expect(rule.enforceability).toBe("not_enforceable");
    expect(rule.recommendedAction).toBeNull();
    expect(rule.action).toBe("allow");
    expect(rule.dataCategories).not.toContain("ai_usage_policy");
  });

  test("maps patient information authorized for clinical data to category-specific destination authorization", () => {
    const sourceText = "Employees may only process patient information using AI systems specifically authorized by Northstar for clinical or healthcare data.";
    const rule = inferOne(sourceText);

    expect(rule.controlType).toBe("destination_restriction");
    expect(rule.enforceability).toBe("partially_enforceable");
    expect(rule.recommendedAction).toBe("block");
    expect(rule.dataCategories).toContain("patient_information");
    expect(rule.destinationTypes).toContain("unapproved");
    expect(rule.conditionDescription).toContain("clinical or healthcare data");
    expect(rule.destinationAuthorizations[0]?.dataCategories).toContain("patient_information");
  });
});
