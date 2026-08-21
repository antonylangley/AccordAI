import { POLICY_SCHEMA_VERSION, type BuiltInPolicyBundleDefinition, type InternalPolicyRule, type PolicyCategory, type PolicyRuleMatch } from "./types";

const CLIENT_BUNDLE_ID = "accord.client-veterinary-data";
const EXTERNAL_AI_BUNDLE_ID = "accord.approved-external-ai";
const CONFIDENTIAL_BUNDLE_ID = "accord.confidential-business";
const SECURITY_BUNDLE_ID = "accord.security-credentials";
const HR_BUNDLE_ID = "accord.employee-hr";

export const DEFAULT_APPROVED_AI_PROVIDERS = ["copilot-enterprise"];

export const BUILT_IN_POLICY_BUNDLES: BuiltInPolicyBundleDefinition[] = [
  {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: CLIENT_BUNDLE_ID,
    version: 1,
    name: "Client & Veterinary Data",
    description: "Protects identifiable client information and confidential veterinary case material without treating veterinary records as human HIPAA data.",
    defaultEnabled: true,
    rules: [
      builtInRule({
        id: "accord.client.identifiers.redact",
        title: "Redact identifiable client information",
        description: "Removes client or owner identifiers while preserving useful non-identifying context.",
        category: "CLIENT_VETERINARY_DATA",
        severity: "HIGH",
        action: "REDACT",
        fallbackAction: "HOLD",
        bundleId: CLIENT_BUNDLE_ID,
        bundleName: "Client & Veterinary Data",
        match: {
          anyDetectors: ["PERSON", "EMAIL", "PHONE", "ADDRESS", "ACCOUNT", "SSN", "PAYMENT_CARD"],
          anyConcepts: ["CLIENT_CONTEXT", "VETERINARY_CASE", "VETERINARY_RECORD"],
          semanticExamples: [
            "Summarize the owner's contact details before sending the case summary.",
            "Review this veterinary patient's record for the client."
          ],
          negativeExamples: ["Explain canine pancreatitis.", "Summarize public veterinary research."],
          exclusions: { concepts: ["PUBLIC_INFORMATION"] }
        },
        short: "Client identifiers are removed locally before the request leaves the browser."
      }),
      builtInRule({
        id: "accord.veterinary.case-identifiers.redact",
        title: "De-identify veterinary case material",
        description: "Redacts identifiers from discharge notes, lab results, diagnostic reports, and treatment plans.",
        category: "CLIENT_VETERINARY_DATA",
        severity: "HIGH",
        action: "REDACT",
        fallbackAction: "HOLD",
        bundleId: CLIENT_BUNDLE_ID,
        bundleName: "Client & Veterinary Data",
        match: {
          anyDetectors: ["PERSON", "EMAIL", "PHONE", "ADDRESS", "ACCOUNT"],
          anyConcepts: ["VETERINARY_CASE", "VETERINARY_RECORD"],
          semanticExamples: [
            "Summarize Neta Rogovsky's dog's discharge notes.",
            "Review this patient's lab results for client Sarah Chen."
          ],
          negativeExamples: ["What are common causes of vomiting in dogs?"],
          exclusions: { concepts: ["PUBLIC_INFORMATION"] }
        },
        short: "Accord de-identifies veterinary case material before AI processing."
      }),
      builtInRule({
        id: "accord.veterinary.full-record.unapproved",
        title: "Hold full veterinary records on unapproved AI",
        description: "Prevents complete confidential case records from being submitted to an unapproved AI destination.",
        category: "CLIENT_VETERINARY_DATA",
        severity: "CRITICAL",
        action: "HOLD",
        bundleId: CLIENT_BUNDLE_ID,
        bundleName: "Client & Veterinary Data",
        providerMode: "unapproved_only",
        match: {
          requireConcepts: ["FULL_VETERINARY_RECORD"],
          semanticExamples: ["Here is the full medical record for Bella, owned by Alex. Review the entire case."],
          negativeExamples: ["Explain a published canine treatment guideline."],
          exclusions: { concepts: ["PUBLIC_INFORMATION"] }
        },
        short: "A full confidential veterinary record requires an organization-approved AI service."
      })
    ]
  },
  {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: EXTERNAL_AI_BUNDLE_ID,
    version: 1,
    name: "Approved AI / External AI Usage",
    description: "Applies destination-aware controls so confidential material is processed only by organization-approved AI services.",
    defaultEnabled: true,
    rules: [
      builtInRule({
        id: "accord.external-ai.confidential.unapproved",
        title: "Hold confidential information on unapproved AI",
        description: "Requires confidential organizational information to use an approved AI destination.",
        category: "EXTERNAL_AI_USAGE",
        severity: "CRITICAL",
        action: "HOLD",
        bundleId: EXTERNAL_AI_BUNDLE_ID,
        bundleName: "Approved AI / External AI Usage",
        providerMode: "unapproved_only",
        match: {
          anyConcepts: [
            "CONFIDENTIAL_BUSINESS",
            "UNPUBLISHED_FINANCIALS",
            "INTERNAL_STRATEGY",
            "INTERNAL_PRICING",
            "CONTRACT_VENDOR_TERMS",
            "BOARD_EXECUTIVE_MATERIAL",
            "INTERNAL_SECURITY_PROCEDURE",
            "PROPRIETARY_TECHNICAL_DOCUMENTATION"
          ],
          semanticExamples: [
            "Analyze our unreleased operating forecast.",
            "Review confidential pricing and expansion plans."
          ],
          negativeExamples: ["Summarize a public earnings release."],
          exclusions: { concepts: ["PUBLIC_INFORMATION"] }
        },
        short: "Confidential organizational information may only be processed by an approved AI service."
      }),
      builtInRule({
        id: "accord.external-ai.client-record.unapproved",
        title: "Hold client records on unapproved AI",
        description: "Routes confidential client and veterinary records away from unapproved AI services.",
        category: "EXTERNAL_AI_USAGE",
        severity: "CRITICAL",
        action: "HOLD",
        bundleId: EXTERNAL_AI_BUNDLE_ID,
        bundleName: "Approved AI / External AI Usage",
        providerMode: "unapproved_only",
        match: {
          anyConcepts: ["FULL_VETERINARY_RECORD"],
          semanticExamples: ["Review the complete client case record."],
          exclusions: { concepts: ["PUBLIC_INFORMATION"] }
        },
        short: "Confidential client records require an approved AI destination."
      }),
      builtInRule({
        id: "accord.external-ai.approved-destination",
        title: "Allow approved AI destination",
        description: "Confirms that provider scope alone does not block confidential material on an approved service; stricter data rules still apply.",
        category: "EXTERNAL_AI_USAGE",
        severity: "LOW",
        action: "ALLOW",
        bundleId: EXTERNAL_AI_BUNDLE_ID,
        bundleName: "Approved AI / External AI Usage",
        providerMode: "approved_only",
        match: {
          anyConcepts: [
            "CONFIDENTIAL_BUSINESS",
            "UNPUBLISHED_FINANCIALS",
            "INTERNAL_STRATEGY",
            "INTERNAL_PRICING",
            "CONTRACT_VENDOR_TERMS",
            "BOARD_EXECUTIVE_MATERIAL",
            "INTERNAL_SECURITY_PROCEDURE",
            "PROPRIETARY_TECHNICAL_DOCUMENTATION",
            "VETERINARY_RECORD",
            "FULL_VETERINARY_RECORD",
            "EMPLOYEE_SENSITIVE_RECORD"
          ],
          exclusions: { concepts: ["PUBLIC_INFORMATION"] }
        },
        short: "The selected AI destination is approved by the organization."
      })
    ]
  },
  {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: CONFIDENTIAL_BUNDLE_ID,
    version: 1,
    name: "Confidential Business Information",
    description: "Protects non-public financials, strategy, pricing, contracts, leadership material, security procedures, and proprietary documentation.",
    defaultEnabled: true,
    rules: [
      builtInRule({
        id: "accord.confidential.unpublished-financials",
        title: "Hold unpublished financial results",
        description: "Protects internal forecasts, margins, projections, and unreleased operating results on unapproved AI.",
        category: "CONFIDENTIAL_BUSINESS",
        severity: "CRITICAL",
        action: "HOLD",
        bundleId: CONFIDENTIAL_BUNDLE_ID,
        bundleName: "Confidential Business Information",
        providerMode: "unapproved_only",
        match: {
          requireConcepts: ["UNPUBLISHED_FINANCIALS"],
          semanticExamples: ["Our unreleased Q4 operating forecast is $18.4M and margins fell 7%."],
          negativeExamples: ["Microsoft publicly released quarterly revenue results."],
          exclusions: { concepts: ["PUBLIC_INFORMATION"] }
        },
        short: "Unpublished financial information cannot be submitted to an unapproved AI service."
      }),
      builtInRule({
        id: "accord.confidential.strategy-pricing-contracts",
        title: "Hold internal strategy, pricing, and commercial terms",
        description: "Protects expansion plans, internal pricing, contracts, and vendor terms on unapproved AI.",
        category: "CONFIDENTIAL_BUSINESS",
        severity: "HIGH",
        action: "HOLD",
        bundleId: CONFIDENTIAL_BUNDLE_ID,
        bundleName: "Confidential Business Information",
        providerMode: "unapproved_only",
        match: {
          anyConcepts: ["INTERNAL_STRATEGY", "INTERNAL_PRICING", "CONTRACT_VENDOR_TERMS"],
          semanticExamples: ["Compare our internal pricing model with the confidential vendor proposal."],
          negativeExamples: ["Explain common pricing strategies."],
          exclusions: { concepts: ["PUBLIC_INFORMATION"] }
        },
        short: "Internal strategy and commercial terms require an approved AI destination."
      }),
      builtInRule({
        id: "accord.confidential.board-security-technical",
        title: "Block highly restricted internal material",
        description: "Blocks board material, internal security procedures, or proprietary technical documentation on unapproved AI.",
        category: "CONFIDENTIAL_BUSINESS",
        severity: "CRITICAL",
        action: "BLOCK",
        bundleId: CONFIDENTIAL_BUNDLE_ID,
        bundleName: "Confidential Business Information",
        providerMode: "unapproved_only",
        match: {
          anyConcepts: ["BOARD_EXECUTIVE_MATERIAL", "INTERNAL_SECURITY_PROCEDURE", "PROPRIETARY_TECHNICAL_DOCUMENTATION"],
          semanticExamples: ["Review the confidential board deck and internal incident response runbook."],
          exclusions: { concepts: ["PUBLIC_INFORMATION"] }
        },
        short: "Highly restricted internal material is blocked on unapproved AI services."
      })
    ]
  },
  {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: SECURITY_BUNDLE_ID,
    version: 1,
    name: "Security & Credentials",
    description: "Uses Accord Core credential findings to redact secrets locally instead of attempting semantic secret detection.",
    defaultEnabled: true,
    rules: [
      builtInRule({
        id: "accord.security.credentials.redact",
        title: "Redact credentials and secrets",
        description: "Redacts API keys, passwords, tokens, and other deterministic Accord Core secret findings.",
        category: "SECURITY_CREDENTIALS",
        severity: "CRITICAL",
        action: "REDACT",
        fallbackAction: "HOLD",
        bundleId: SECURITY_BUNDLE_ID,
        bundleName: "Security & Credentials",
        match: {
          anyDetectors: ["SECRET", "PASSWORD", "API_TOKEN", "BEARER_TOKEN"],
          semanticExamples: ["Use this API key to call the service."],
          negativeExamples: ["Explain how API key rotation works."]
        },
        short: "Accord Core detected and removed credential material locally."
      }),
      builtInRule({
        id: "accord.security.private-infrastructure.redact",
        title: "Redact private keys and database credentials",
        description: "Redacts private keys and credential-bearing database URLs using Accord Core findings.",
        category: "SECURITY_CREDENTIALS",
        severity: "CRITICAL",
        action: "REDACT",
        fallbackAction: "HOLD",
        bundleId: SECURITY_BUNDLE_ID,
        bundleName: "Security & Credentials",
        match: {
          anyDetectors: ["PRIVATE_KEY", "DATABASE_URL", "SECRET"],
          semanticExamples: ["Debug this private key or database connection URL."],
          negativeExamples: ["What is a database URL?"]
        },
        short: "Accord Core removed private infrastructure credentials locally."
      })
    ]
  },
  {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: HR_BUNDLE_ID,
    version: 1,
    name: "Employee & HR Information",
    description: "Protects compensation, performance, disciplinary, termination, and sensitive employee records.",
    defaultEnabled: false,
    rules: [
      builtInRule({
        id: "accord.hr.records.unapproved",
        title: "Hold sensitive employee records on unapproved AI",
        description: "Protects compensation, performance, disciplinary, and termination material.",
        category: "EMPLOYEE_HR",
        severity: "HIGH",
        action: "HOLD",
        bundleId: HR_BUNDLE_ID,
        bundleName: "Employee & HR Information",
        providerMode: "unapproved_only",
        match: {
          requireConcepts: ["EMPLOYEE_SENSITIVE_RECORD"],
          semanticExamples: ["Draft a termination memo from this employee performance review."],
          exclusions: { concepts: ["PUBLIC_INFORMATION"] }
        },
        short: "Sensitive employee records require an approved AI service."
      }),
      builtInRule({
        id: "accord.hr.identifiers.redact",
        title: "Redact employee identifiers",
        description: "De-identifies employee-sensitive content when identifiers can be safely removed.",
        category: "EMPLOYEE_HR",
        severity: "HIGH",
        action: "REDACT",
        fallbackAction: "HOLD",
        bundleId: HR_BUNDLE_ID,
        bundleName: "Employee & HR Information",
        match: {
          requireConcepts: ["EMPLOYEE_SENSITIVE_RECORD"],
          anyDetectors: ["PERSON", "EMAIL", "PHONE", "ADDRESS", "ACCOUNT", "SSN"],
          semanticExamples: ["Summarize Jordan's disciplinary record without identifying them."]
        },
        short: "Employee identifiers are removed locally before AI processing."
      })
    ]
  }
];

export const DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS = BUILT_IN_POLICY_BUNDLES.filter((bundle) => bundle.defaultEnabled).map((bundle) => bundle.id);

export function builtInRulesForSelection(bundleIds: string[]) {
  const enabled = new Set(bundleIds);
  return BUILT_IN_POLICY_BUNDLES.filter((bundle) => enabled.has(bundle.id)).flatMap((bundle) => bundle.rules);
}

function builtInRule(input: {
  id: string;
  title: string;
  description: string;
  category: PolicyCategory;
  severity: InternalPolicyRule["severity"];
  action: InternalPolicyRule["action"];
  fallbackAction?: InternalPolicyRule["fallbackAction"];
  bundleId: string;
  bundleName: string;
  providerMode?: InternalPolicyRule["scope"]["providerMode"];
  match: PolicyRuleMatch;
  short: string;
}): InternalPolicyRule {
  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: input.id,
    version: 1,
    title: input.title,
    description: input.description,
    category: input.category,
    severity: input.severity,
    action: input.action,
    fallbackAction: input.fallbackAction,
    source: {
      type: "accord_builtin",
      bundleId: input.bundleId,
      bundleName: input.bundleName,
      section: input.title
    },
    scope: {
      enabled: true,
      providerMode: input.providerMode || "any",
      apps: ["chatgpt", "copilot", "claude", "gemini"]
    },
    match: input.match,
    explanation: {
      short: input.short,
      user: input.short,
      admin: input.description
    }
  };
}
