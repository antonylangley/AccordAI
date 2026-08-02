import type { EntityCountSummary } from "@accord/governance-core";
import type { SafeRiskFlag } from "../messaging/types";

export type PolicyRuleAction = "allow" | "transform" | "warn" | "require_approval" | "block";
export type PolicyDestinationType = "any" | "approved" | "enterprise" | "personal" | "unapproved";
export type PolicySeverity = "low" | "medium" | "high" | "critical";

export type PolicyBundleRule = {
  id: string;
  ruleKey: string;
  version: number;
  name: string;
  sourcePolicyName: string;
  sourceSection: string;
  supportingExcerpt: string;
  dataCategories: string[];
  userScope: string;
  departmentScope: string;
  aiProvider: string;
  destinationType: PolicyDestinationType;
  action: PolicyRuleAction;
  fallbackAction: PolicyRuleAction;
  severity: PolicySeverity;
  employeeExplanation: string;
  effectiveDate: string;
};

export type PublishedPolicyBundle = {
  id: string;
  companySlug: string;
  version: number;
  status: "published" | "superseded";
  checksum: string;
  ruleCount: number;
  publishedAt: string;
  supersededAt?: string;
  rules: PolicyBundleRule[];
};

export type PolicyEvaluationContext = {
  aiProvider: string;
  destinationType: PolicyDestinationType;
  contentType: "prompt" | "attachment";
  userScope?: string;
  departmentScope?: string;
};

export type PolicySignalSet = {
  flags: SafeRiskFlag[];
  entityCounts: EntityCountSummary;
  riskScore: number;
  redactionCount: number;
  sanitizedTextAvailable: boolean;
};

export type AppliedPolicyDecision = {
  triggered: boolean;
  executionAction: "allow" | "warn" | "redact" | "block";
  policyAction: PolicyRuleAction;
  fallbackAction?: PolicyRuleAction;
  explanation: string;
  detectedCategories: string[];
  bundleId?: string;
  bundleVersion?: number;
  bundleChecksum?: string;
  rule?: PolicyBundleRule;
};
