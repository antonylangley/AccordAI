import {
  BUILT_IN_POLICY_BUNDLES,
  DEFAULT_APPROVED_AI_PROVIDERS,
  DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS,
  POLICY_SCHEMA_VERSION,
  builtInRulesForSelection,
  evaluatePolicySet,
  retrievePolicyCandidates,
  validateBuiltInPolicyBundle,
  validateInternalPolicyRule,
  validatePublishedEnforcementBundle,
  type InternalPolicyRule,
  type PolicyEvaluationInput
} from "@accord/governance-core";
import { describe, expect, test } from "vitest";

describe("internal enforcement schema", () => {
  test("validates every built-in bundle and rule", () => {
    expect(BUILT_IN_POLICY_BUNDLES.every(validateBuiltInPolicyBundle)).toBe(true);
    expect(BUILT_IN_POLICY_BUNDLES.flatMap((bundle) => bundle.rules).every(validateInternalPolicyRule)).toBe(true);
    expect(
      validatePublishedEnforcementBundle({
        schemaVersion: POLICY_SCHEMA_VERSION,
        id: "bundle_1",
        companySlug: "test-company",
        version: 1,
        status: "published",
        checksum: "checksum",
        ruleCount: 1,
        publishedAt: "2026-08-21T00:00:00.000Z",
        enabledBuiltInBundleIds: DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS,
        approvedProviders: DEFAULT_APPROVED_AI_PROVIDERS,
        rules: [rule("accord.security.credentials.redact")]
      })
    ).toBe(true);
  });
});

describe("retrieval and enforcement separation", () => {
  test("semantic examples can retrieve but cannot enforce without deterministic evidence", () => {
    const retrievalOnly: InternalPolicyRule = {
      ...rule("accord.confidential.unpublished-financials"),
      id: "test.retrieval-only",
      match: { semanticExamples: ["Analyze our unreleased operating forecast."] }
    };
    const input = policyInput("Analyze our unreleased operating forecast.");

    expect(retrievePolicyCandidates([retrievalOnly], input)).toHaveLength(1);
    expect(evaluatePolicySet([retrievalOnly], input).triggered).toBe(false);
  });

  test("detector-backed security rule redacts locally", () => {
    const decision = evaluatePolicySet(builtInRulesForSelection(DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS), {
      ...policyInput("Use this value to authenticate."),
      detectors: ["SECRET"],
      redactionAvailable: true
    });

    expect(decision.action).toBe("REDACT");
    expect(decision.primaryRule?.category).toBe("SECURITY_CREDENTIALS");
  });

  test("provider scope distinguishes approved and unapproved destinations", () => {
    const rules = builtInRulesForSelection(DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS);
    const text = "Our unreleased Q4 operating forecast is confidential.";
    const unapproved = evaluatePolicySet(rules, policyInput(text, "chatgpt"));
    const approved = evaluatePolicySet(rules, policyInput(text, "copilot-enterprise"));

    expect(unapproved.action).toBe("HOLD");
    expect(approved.action).toBe("ALLOW");
    expect(approved.primaryRule?.id).toBe("accord.external-ai.approved-destination");
  });

  test("public-information exclusions allow a hard negative", () => {
    const decision = evaluatePolicySet(
      builtInRulesForSelection(DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS),
      policyInput("Summarize Microsoft's publicly released quarterly revenue in its earnings report.")
    );

    expect(decision.triggered).toBe(false);
  });

  test("BLOCK wins and organization policy wins ties", () => {
    const builtIn = rule("accord.security.credentials.redact");
    const orgBlock: InternalPolicyRule = {
      ...builtIn,
      id: "org.credentials.block",
      action: "BLOCK",
      source: {
        type: "organization_policy",
        documentId: "document-1",
        documentName: "AI Acceptable Use Policy",
        section: "4.2"
      }
    };
    const orgRedact: InternalPolicyRule = { ...orgBlock, id: "org.credentials.redact", action: "REDACT" };
    const decision = evaluatePolicySet([builtIn, orgRedact, orgBlock], {
      ...policyInput("Use this credential."),
      detectors: ["SECRET"],
      redactionAvailable: true
    });

    expect(decision.action).toBe("BLOCK");
    expect(decision.primaryRule?.id).toBe("org.credentials.block");
    expect(decision.explanation?.source).toBe("organization_policy");
    expect(decision.explanation?.sourceReference).toBe("AI Acceptable Use Policy · 4.2");
  });
});

function policyInput(text: string, provider = "chatgpt"): PolicyEvaluationInput {
  return {
    text,
    detectors: [],
    context: {
      provider,
      app: provider.startsWith("copilot") ? "copilot" : "chatgpt",
      approvedProviders: DEFAULT_APPROVED_AI_PROVIDERS,
      contentType: "prompt"
    },
    redactionAvailable: false
  };
}

function rule(id: string) {
  const match = BUILT_IN_POLICY_BUNDLES.flatMap((bundle) => bundle.rules).find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing test rule: ${id}`);
  return match;
}
