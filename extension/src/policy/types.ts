import type {
  EntityCountSummary,
  InternalPolicyRule,
  PolicyAction,
  PolicyDecisionExplanation,
  PolicyEvaluationContext as SharedPolicyEvaluationContext,
  PublishedEnforcementBundle
} from "@accord/governance-core";
import type { SafeRiskFlag } from "../messaging/types";

export type PublishedPolicyBundle = PublishedEnforcementBundle;

export type PolicyEvaluationContext = Omit<SharedPolicyEvaluationContext, "approvedProviders"> & {
  approvedProviders?: string[];
};

export type PolicySignalSet = {
  text: string;
  flags: SafeRiskFlag[];
  entityCounts: EntityCountSummary;
  riskScore: number;
  redactionCount: number;
  sanitizedTextAvailable: boolean;
};

export type AppliedPolicyDecision = {
  triggered: boolean;
  executionAction: "allow" | "redact" | "block";
  policyAction: PolicyAction;
  explanation: string;
  structuredExplanation?: PolicyDecisionExplanation;
  detectedCategories: string[];
  matchedRuleIds: string[];
  retrievedRuleIds: string[];
  bundleId?: string;
  bundleVersion?: number;
  bundleChecksum?: string;
  rule?: InternalPolicyRule;
};
