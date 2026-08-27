import type { ImportedPolicyEnforceability, ImportedPolicyRecommendedAction, ImportedPolicyRuleAction } from "./types";

export function isPolicyGuidanceOnly(enforceability: ImportedPolicyEnforceability) {
  return enforceability === "not_enforceable";
}

export function isCandidateEnforcementControl(input: {
  enforceability: ImportedPolicyEnforceability;
  recommendedAction: ImportedPolicyRecommendedAction | null;
}) {
  return !isPolicyGuidanceOnly(input.enforceability) && input.recommendedAction !== null;
}

export function canApprovePolicyRuleControl(input: { enforceability: ImportedPolicyEnforceability }) {
  return !isPolicyGuidanceOnly(input.enforceability);
}

export function canPublishPolicyRuleControl(input: { enforceability: ImportedPolicyEnforceability }) {
  return canApprovePolicyRuleControl(input);
}

export function recommendedActionToRuleAction(action: ImportedPolicyRecommendedAction | null): ImportedPolicyRuleAction {
  if (action === "redact") return "transform";
  return action || "allow";
}

export function ruleActionToRecommendedAction(action: ImportedPolicyRuleAction): ImportedPolicyRecommendedAction | null {
  if (action === "transform") return "redact";
  if (action === "allow") return null;
  return action;
}
