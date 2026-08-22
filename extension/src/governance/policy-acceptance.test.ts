import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  BUILT_IN_POLICY_BUNDLES,
  DEFAULT_APPROVED_AI_PROVIDERS,
  POLICY_SCHEMA_VERSION,
  builtInRulesForSelection,
  type InternalPolicyRule,
  type PolicyAction
} from "@accord/governance-core";
import { scanDraft } from "./scan-session";
import type { PublishedPolicyBundle } from "../policy/types";

const personDetector = vi.hoisted(() => ({ detectPersonCandidates: vi.fn() }));
const policyBundleClient = vi.hoisted(() => ({ getActivePolicyBundle: vi.fn() }));

vi.mock("../person-detection/person-detector", () => personDetector);
vi.mock("../policy/bundle-client", () => policyBundleClient);

const sessionStore: Record<string, unknown> = {};
const defaultBuiltInBundleIds = BUILT_IN_POLICY_BUNDLES.filter((bundle) => bundle.defaultEnabled).map(
  (bundle) => bundle.id
);

beforeEach(() => {
  personDetector.detectPersonCandidates.mockReset();
  personDetector.detectPersonCandidates.mockResolvedValue(noPeople());
  policyBundleClient.getActivePolicyBundle.mockReset();
  policyBundleClient.getActivePolicyBundle.mockResolvedValue(null);
  for (const key of Object.keys(sessionStore)) delete sessionStore[key];
  globalThis.chrome = {
    storage: {
      session: {
        get(keys: string | string[], callback: (items: Record<string, unknown>) => void) {
          if (Array.isArray(keys)) {
            callback(Object.fromEntries(keys.map((key) => [key, sessionStore[key]])));
          } else {
            callback({ [keys]: sessionStore[keys] });
          }
        },
        set(items: Record<string, unknown>, callback?: () => void) {
          Object.assign(sessionStore, items);
          callback?.();
        }
      }
    }
  } as unknown as typeof chrome;
});

describe("Accord policy acceptance", () => {
  test.each([
    [
      "internal pricing",
      "Compare our confidential internal pricing model and proposed customer discount schedule.",
      "internal_pricing"
    ],
    [
      "confidential board material",
      "Summarize this confidential board deck and identify the main risks for executives.",
      "board_executive_material"
    ],
    [
      "restricted incident-response procedures",
      "Improve our restricted internal incident response runbook and access procedure.",
      "internal_security_procedure"
    ],
    [
      "proprietary architecture",
      "Review our proprietary system architecture and confidential implementation details.",
      "proprietary_technical_documentation"
    ]
  ])("blocks organization-policy-sensitive %s", async (_case, text, concept) => {
    const organizationRule = organizationConfidentialRule();
    const result = await scan(text, `acceptance:organization-block:${concept}`, bundle([organizationRule]));

    expect(result.action).toBe("block");
    expect(result.detectedEntityCount).toBe(0);
    expect(result.enforcementSource).toBe("organization_policy");
    expect(result.policy).toMatchObject({
      policyAction: "BLOCK",
      executionAction: "block",
      rule: {
        id: organizationRule.id,
        category: "CONFIDENTIAL_BUSINESS",
        action: "BLOCK",
        source: { type: "organization_policy" }
      },
      structuredExplanation: {
        source: "organization_policy",
        ruleId: organizationRule.id,
        action: "BLOCK"
      }
    });
    expect(result.policy?.matchedRuleIds).toContain(organizationRule.id);
    expect(result.policy?.detectedCategories).toContain(concept);
  });

  test.each([
    "Explain what a security runbook is.",
    "Summarize Microsoft's publicly released quarterly revenue from its earnings report.",
    "Summarize publicly released research about treating vomiting in dogs.",
    "Explain prompt injection attacks and provide defensive examples.",
    "Explain common employee performance-review practices."
  ])("allows contextual public, general, or explanatory text: %s", async (text) => {
    const result = await scan(text, `acceptance:contextual-allow:${text}`, bundle([organizationConfidentialRule()]));

    expect(result.action).toBe("allow");
    expect(result.detectedEntityCount).toBe(0);
    expect(result.enforcementSource).toBe("accord_core");
    expect(result.policy).toBeUndefined();
  });

  test("does not treat explanatory wording as an exemption for a specific confidential HR record", async () => {
    const result = await scan(
      "Explain common practices in this confidential employee performance review.",
      "acceptance:contextual-hr-specific",
      bundle([organizationConfidentialRule()])
    );

    expect(result.action).toBe("block");
    expect(result.enforcementSource).toBe("accord_builtin");
    expect(result.policy).toBeDefined();
    expect(result.policy?.matchedRuleIds.length).toBeGreaterThan(0);
    expect(result.policy?.rule).toBeDefined();
    expect(result.policy?.rule?.source.type).toBe("accord_builtin");
    expect(result.flags).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "regulated_hr", source: "accord_core" })])
    );
  });

  test("organization BLOCK overrides built-in REDACT without changing detection", async () => {
    const text = "Summarize this veterinary case for client Sarah Chen at sarah.chen@example.com.";
    const blockRule = organizationClientIdentifierRule("BLOCK");
    const redactRule = organizationClientIdentifierRule("REDACT");

    const blocked = await scan(text, "acceptance:precedence:block", bundle([blockRule]), ["Sarah Chen"]);
    const redacted = await scan(text, "acceptance:precedence:redact", bundle([redactRule]), ["Sarah Chen"]);

    expect(blocked.action).toBe("block");
    expect(blocked.enforcementSource).toBe("organization_policy");
    expect(blocked.policy).toMatchObject({
      policyAction: "BLOCK",
      executionAction: "block",
      rule: { id: blockRule.id, source: { type: "organization_policy" } }
    });
    expect(blocked.policy?.matchedRuleIds).toEqual(
      expect.arrayContaining([blockRule.id, "accord.client.identifiers.redact"])
    );

    expect(redacted.action).toBe("redact");
    expect(redacted.policy).toMatchObject({
      policyAction: "REDACT",
      executionAction: "redact",
      rule: { id: redactRule.id, source: { type: "organization_policy" } }
    });
    expect(redacted.policy?.matchedRuleIds).toEqual(
      expect.arrayContaining([redactRule.id, "accord.client.identifiers.redact"])
    );

    for (const result of [blocked, redacted]) {
      expect(result.entityCounts).toMatchObject({ PERSON: 1, EMAIL: 1 });
      expect(result.decorations.map(({ type }) => type)).toEqual(["PERSON", "EMAIL"]);
      expect(result.sanitizedText).toContain("[PERSON_1]");
      expect(result.sanitizedText).toContain("[EMAIL_1]");
      expect(result.personDetection).toMatchObject({
        nerStatus: "ready",
        detector: "accord_ner_v0_3_1_test",
        candidateCount: 1
      });
      expect(result.policy?.detectedCategories).toEqual(expect.arrayContaining(["person", "email", "client_context"]));
    }

    expect(redacted.entityCounts).toEqual(blocked.entityCounts);
    expect(redacted.decorations).toEqual(blocked.decorations);
  });

  test("an independent organization HR policy remains active when the built-in HR bundle is disabled", async () => {
    const text = "Summarize this employee performance review for Jordan Lee.";
    const hrRule = organizationHrRule(true);
    const activeBundle = bundle([hrRule]);

    expect(activeBundle.enabledBuiltInBundleIds).not.toContain("accord.employee-hr");
    const result = await scan(text, "acceptance:hr:organization-enabled", activeBundle, ["Jordan Lee"]);

    expect(result.action).toBe("block");
    expect(result.enforcementSource).toBe("organization_policy");
    expect(result.entityCounts.PERSON).toBe(1);
    expect(result.policy).toMatchObject({
      policyAction: "BLOCK",
      rule: { id: hrRule.id, category: "EMPLOYEE_HR", source: { type: "organization_policy" } }
    });
    expect(result.policy?.matchedRuleIds).toContain(hrRule.id);
    expect(result.policy?.detectedCategories).toEqual(expect.arrayContaining(["person", "employee_sensitive_record"]));
  });

  test("disabling the independent organization HR policy removes its enforcement without stale policy state", async () => {
    const text = "Summarize this employee performance review for Jordan Lee.";
    const result = await scan(
      text,
      "acceptance:hr:organization-disabled",
      bundle([organizationHrRule(false)]),
      ["Jordan Lee"]
    );

    expect(result.action).toBe("redact");
    expect(result.enforcementSource).toBe("accord_core");
    expect(result.policy).toBeUndefined();
    expect(result.entityCounts.PERSON).toBe(1);
    expect(result.sanitizedText).toContain("[PERSON_1]");
  });

  test("preserves Core PERSON and EMAIL findings alongside an organization policy block", async () => {
    const text =
      "Summarize this veterinary case for client Sarah Chen at sarah.chen@example.com and compare our confidential internal pricing model.";
    const organizationRule = organizationConfidentialRule();
    const result = await scan(text, "acceptance:mixed-detection-policy", bundle([organizationRule]), ["Sarah Chen"]);

    expect(result.action).toBe("block");
    expect(result.enforcementSource).toBe("organization_policy");
    expect(result.entityCounts).toMatchObject({ PERSON: 1, EMAIL: 1 });
    expect(result.decorations.map(({ type }) => type)).toEqual(["PERSON", "EMAIL"]);
    expect(result.sanitizedText).toContain("[PERSON_1]");
    expect(result.sanitizedText).toContain("[EMAIL_1]");
    expect(result.personDetection).toMatchObject({
      nerStatus: "ready",
      detector: "accord_ner_v0_3_1_test",
      candidateCount: 1
    });
    expect(result.policy).toMatchObject({
      policyAction: "BLOCK",
      rule: { id: organizationRule.id, source: { type: "organization_policy" } }
    });
    expect(result.policy?.matchedRuleIds).toContain(organizationRule.id);
    expect(result.policy?.detectedCategories).toEqual(
      expect.arrayContaining(["person", "email", "veterinary_case", "client_context", "internal_pricing"])
    );
    expect(result.flags.every((flag) => flag.source === "accord_core")).toBe(true);
  });
});

function scan(
  text: string,
  conversationKey: string,
  activeBundle: PublishedPolicyBundle,
  people: readonly string[] = []
) {
  personDetector.detectPersonCandidates.mockResolvedValueOnce(personResult(text, people));
  policyBundleClient.getActivePolicyBundle.mockResolvedValueOnce(activeBundle);
  return scanDraft({
    surface: "chatgpt",
    conversationKey,
    text,
    sensitivity: "Internal",
    authoritative: true,
    includeSanitizedText: true
  });
}

function personResult(text: string, people: readonly string[]) {
  return {
    candidates: people.map((originalText) => {
      const start = text.indexOf(originalText);
      if (start < 0) throw new Error(`Missing explicit PERSON test span: ${originalText}`);
      return {
        type: "PERSON" as const,
        originalText,
        start,
        end: start + originalText.length,
        confidence: 0.99,
        detector: "accord_ner_v0_3_1_test",
        contextSignals: ["ner_person"]
      };
    }),
    coverage: {
      mode: "local-ner" as const,
      nerStatus: "ready" as const,
      detector: "accord_ner_v0_3_1_test",
      candidateCount: people.length,
      timedOut: false,
      model: {
        name: "accord-ner-v0.3.1",
        assetSizeBytes: 0,
        executionContext: "service_worker" as const
      }
    }
  };
}

function noPeople() {
  return personResult("", []);
}

function bundle(
  organizationRules: InternalPolicyRule[],
  enabledBuiltInBundleIds: string[] = defaultBuiltInBundleIds
): PublishedPolicyBundle {
  const rules = [...builtInRulesForSelection(enabledBuiltInBundleIds), ...organizationRules];
  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: "bundle_policy-acceptance_1",
    companySlug: "test-company",
    version: 1,
    status: "published",
    checksum: "policy-acceptance-checksum",
    ruleCount: rules.length,
    publishedAt: "2026-08-21T00:00:00.000Z",
    enabledBuiltInBundleIds: [...enabledBuiltInBundleIds],
    approvedProviders: [...DEFAULT_APPROVED_AI_PROVIDERS],
    rules
  };
}

function organizationConfidentialRule(): InternalPolicyRule {
  return {
    ...builtInRule("accord.confidential.board-security-technical"),
    id: "org.imported-ai-usage.confidential.block",
    title: "Do not submit confidential data to unapproved AI",
    description: "Blocks confidential, restricted, proprietary, or internal business material on unapproved AI.",
    action: "BLOCK",
    source: {
      type: "organization_policy",
      documentId: "doc_synthetic-organization-policy",
      documentName: "Synthetic Organization AI Policy",
      section: "Confidential Business Information"
    },
    match: {
      anyConcepts: [
        "INTERNAL_PRICING",
        "BOARD_EXECUTIVE_MATERIAL",
        "INTERNAL_SECURITY_PROCEDURE",
        "PROPRIETARY_TECHNICAL_DOCUMENTATION"
      ],
      exclusions: { concepts: ["PUBLIC_INFORMATION"] }
    },
    explanation: {
      short: "Organization policy blocks confidential internal information on unapproved AI."
    }
  };
}

function organizationClientIdentifierRule(action: Extract<PolicyAction, "BLOCK" | "REDACT">): InternalPolicyRule {
  return {
    ...builtInRule("accord.client.identifiers.redact"),
    id: "org.imported-ai-usage.client-identifiers",
    title: "Do not submit client identifying information to unapproved AI",
    description: "Applies the organization's configured action to identifying client information.",
    severity: "CRITICAL",
    action,
    fallbackAction: action === "REDACT" ? "HOLD" : undefined,
    source: {
      type: "organization_policy",
      documentId: "doc_synthetic-organization-policy",
      documentName: "Synthetic Organization AI Policy",
      section: "Client Identifying Information"
    },
    scope: {
      enabled: true,
      providerMode: "unapproved_only",
      apps: ["chatgpt"]
    },
    match: {
      anyDetectors: ["PERSON", "EMAIL", "PHONE", "ADDRESS", "ACCOUNT"],
      anyConcepts: ["CLIENT_CONTEXT", "VETERINARY_CASE", "VETERINARY_RECORD"],
      exclusions: { concepts: ["PUBLIC_INFORMATION"] }
    },
    explanation: {
      short: `Organization policy ${action === "BLOCK" ? "blocks" : "redacts"} client identifying information.`
    }
  };
}

function organizationHrRule(enabled: boolean): InternalPolicyRule {
  return {
    ...builtInRule("accord.hr.records.unapproved"),
    id: "org.imported-ai-usage.hr.block",
    title: "Do not submit employee HR information to unapproved AI",
    description: "Blocks sensitive employee records under an independently imported organization policy.",
    action: "BLOCK",
    source: {
      type: "organization_policy",
      documentId: "doc_synthetic-organization-policy",
      documentName: "Synthetic Organization AI Policy",
      section: "Human Resources"
    },
    scope: {
      enabled,
      providerMode: "unapproved_only",
      apps: ["chatgpt"]
    },
    match: {
      requireConcepts: ["EMPLOYEE_SENSITIVE_RECORD"]
    },
    explanation: {
      short: "Organization policy blocks sensitive employee records on unapproved AI."
    }
  };
}

function builtInRule(id: string): InternalPolicyRule {
  const rule = BUILT_IN_POLICY_BUNDLES.flatMap((bundleDefinition) => bundleDefinition.rules).find(
    (candidate) => candidate.id === id
  );
  if (!rule) throw new Error(`Missing built-in policy test fixture: ${id}`);
  return rule;
}
