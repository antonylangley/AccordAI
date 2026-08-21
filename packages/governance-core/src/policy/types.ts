export const POLICY_SCHEMA_VERSION = 2 as const;

export type PolicyCategory =
  | "CLIENT_VETERINARY_DATA"
  | "CONFIDENTIAL_BUSINESS"
  | "EXTERNAL_AI_USAGE"
  | "EMPLOYEE_HR"
  | "SECURITY_CREDENTIALS";

export type PolicySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PolicyAction = "ALLOW" | "REDACT" | "HOLD" | "BLOCK";
export type PolicySourceType = "accord_builtin" | "organization_policy";
export type PolicyProviderMode = "any" | "approved_only" | "unapproved_only";

export type PolicyDetectorSignal =
  | "PERSON"
  | "EMAIL"
  | "PHONE"
  | "ADDRESS"
  | "ACCOUNT"
  | "SSN"
  | "PAYMENT_CARD"
  | "IP_ADDRESS"
  | "SECRET"
  | "PASSWORD"
  | "API_TOKEN"
  | "PRIVATE_KEY"
  | "DATABASE_URL"
  | "BEARER_TOKEN"
  | "REGULATED_FINANCIAL"
  | "REGULATED_LEGAL"
  | "REGULATED_MEDICAL"
  | "REGULATED_HR";

export type PolicyConcept =
  | "CLIENT_CONTEXT"
  | "VETERINARY_CASE"
  | "VETERINARY_RECORD"
  | "FULL_VETERINARY_RECORD"
  | "CONFIDENTIAL_BUSINESS"
  | "UNPUBLISHED_FINANCIALS"
  | "INTERNAL_STRATEGY"
  | "INTERNAL_PRICING"
  | "CONTRACT_VENDOR_TERMS"
  | "BOARD_EXECUTIVE_MATERIAL"
  | "INTERNAL_SECURITY_PROCEDURE"
  | "PROPRIETARY_TECHNICAL_DOCUMENTATION"
  | "EMPLOYEE_SENSITIVE_RECORD"
  | "PUBLIC_INFORMATION";

export type PolicyRuleSource = {
  type: PolicySourceType;
  bundleId?: string;
  bundleName?: string;
  documentId?: string;
  documentName?: string;
  section?: string;
  page?: number;
  excerpt?: string;
};

export type PolicyRuleScope = {
  enabled: boolean;
  providerMode?: PolicyProviderMode;
  providers?: string[];
  blockedProviders?: string[];
  apps?: string[];
  userGroups?: string[];
};

export type PolicyRuleMatch = {
  semanticExamples?: string[];
  negativeExamples?: string[];
  keywords?: string[];
  requireDetectors?: PolicyDetectorSignal[];
  anyDetectors?: PolicyDetectorSignal[];
  requireConcepts?: PolicyConcept[];
  anyConcepts?: PolicyConcept[];
  exclusions?: {
    concepts?: PolicyConcept[];
    keywords?: string[];
  };
};

export type PolicyRuleExplanation = {
  short: string;
  admin?: string;
  user?: string;
};

export type InternalPolicyRule = {
  schemaVersion: typeof POLICY_SCHEMA_VERSION;
  id: string;
  version: number;
  title: string;
  description: string;
  category: PolicyCategory;
  severity: PolicySeverity;
  action: PolicyAction;
  fallbackAction?: PolicyAction;
  source: PolicyRuleSource;
  scope: PolicyRuleScope;
  match: PolicyRuleMatch;
  explanation: PolicyRuleExplanation;
};

export type BuiltInPolicyBundleDefinition = {
  schemaVersion: typeof POLICY_SCHEMA_VERSION;
  id: string;
  version: number;
  name: string;
  description: string;
  defaultEnabled: boolean;
  rules: InternalPolicyRule[];
};

export type PublishedEnforcementBundle = {
  schemaVersion: typeof POLICY_SCHEMA_VERSION;
  id: string;
  companySlug: string;
  version: number;
  status: "published" | "superseded";
  checksum: string;
  ruleCount: number;
  publishedAt: string;
  supersededAt?: string;
  enabledBuiltInBundleIds: string[];
  approvedProviders: string[];
  rules: InternalPolicyRule[];
};

export type PolicyEvaluationContext = {
  provider: string;
  app: string;
  approvedProviders: string[];
  userGroups?: string[];
  contentType: "prompt" | "attachment";
};

export type PolicyEvaluationInput = {
  text: string;
  detectors: PolicyDetectorSignal[];
  context: PolicyEvaluationContext;
  redactionAvailable: boolean;
};

export type PolicyCandidateReason = {
  type: "detector" | "concept" | "keyword" | "semantic_example";
  value: string;
  score: number;
};

export type RetrievedPolicyCandidate = {
  rule: InternalPolicyRule;
  relevance: number;
  reasons: PolicyCandidateReason[];
};

export type PolicyRuleEvaluation = {
  matched: boolean;
  rule: InternalPolicyRule;
  action: PolicyAction;
  reasons: string[];
  rejectionReason?: string;
};

export type PolicyDecisionExplanation = {
  source: PolicySourceType;
  ruleId: string;
  ruleTitle: string;
  bundleName?: string;
  severity: PolicySeverity;
  action: PolicyAction;
  reason: string;
  sourceReference: string;
};

export type ResolvedPolicyDecision = {
  triggered: boolean;
  action: PolicyAction;
  source?: PolicySourceType;
  primaryRule?: InternalPolicyRule;
  matchedRuleIds: string[];
  retrievedRuleIds: string[];
  detectedConcepts: PolicyConcept[];
  explanation?: PolicyDecisionExplanation;
};
