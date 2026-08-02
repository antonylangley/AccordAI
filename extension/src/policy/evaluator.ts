import type { EntityCountSummary } from "@accord/governance-core";
import type {
  AppliedPolicyDecision,
  PolicyBundleRule,
  PolicyEvaluationContext,
  PolicyRuleAction,
  PolicySignalSet,
  PublishedPolicyBundle
} from "./types";

const precedence: Record<AppliedPolicyDecision["executionAction"], number> = {
  block: 5,
  redact: 3,
  warn: 2,
  allow: 1
};

export function evaluatePolicyBundle(
  bundle: PublishedPolicyBundle | null,
  signals: PolicySignalSet,
  context: PolicyEvaluationContext
): AppliedPolicyDecision {
  const detectedCategories = detectedPolicyCategories(signals);
  if (!bundle || !bundle.rules.length || !detectedCategories.length) {
    return allowDecision(detectedCategories);
  }

  const candidates = bundle.rules
    .filter((rule) => ruleMatches(rule, detectedCategories, context))
    .map((rule) => decisionForRule(bundle, rule, signals, detectedCategories))
    .sort((a, b) => precedence[b.executionAction] - precedence[a.executionAction] || severityWeight(b.rule?.severity) - severityWeight(a.rule?.severity));

  return candidates[0] || allowDecision(detectedCategories);
}

export function detectedPolicyCategories(signals: Pick<PolicySignalSet, "flags" | "entityCounts">) {
  const categories = new Set<string>();
  const entityCounts = signals.entityCounts || {};

  if (hasEntity(entityCounts, "PERSON") || hasEntity(entityCounts, "EMAIL") || hasEntity(entityCounts, "PHONE")) {
    categories.add("personal_data");
    categories.add("client_identifying_info");
  }
  if (hasEntity(entityCounts, "ADDRESS")) {
    categories.add("personal_data");
    categories.add("client_identifying_info");
    categories.add("address");
  }
  if (hasEntity(entityCounts, "ACCOUNT")) {
    categories.add("client_identifying_info");
    categories.add("account");
    categories.add("payment_information");
  }
  if (hasEntity(entityCounts, "SECRET")) {
    categories.add("secret");
  }

  for (const flag of signals.flags) {
    if (flag.type === "regulated_financial") categories.add("regulated_financial_context");
    if (flag.type === "regulated_medical") {
      categories.add("regulated_medical_context");
      categories.add("veterinary_medical_record");
    }
    if (flag.type === "regulated_legal") categories.add("regulated_legal_context");
    if (flag.type === "regulated_hr") categories.add("regulated_hr_context");
    if (flag.type === "prompt_injection") categories.add("prompt_injection");
    if (["email", "phone", "address", "account", "possible_name"].includes(flag.type)) {
      categories.add("personal_data");
      categories.add("client_identifying_info");
    }
  }

  return Array.from(categories).sort();
}

function decisionForRule(
  bundle: PublishedPolicyBundle,
  rule: PolicyBundleRule,
  signals: PolicySignalSet,
  detectedCategories: string[]
): AppliedPolicyDecision {
  const executionAction = executionActionForRule(rule.action, rule.fallbackAction, signals);

  return {
    triggered: true,
    executionAction,
    policyAction: rule.action,
    fallbackAction: rule.fallbackAction,
    explanation: explanationForDecision(rule, executionAction, detectedCategories),
    detectedCategories,
    bundleId: bundle.id,
    bundleVersion: bundle.version,
    bundleChecksum: bundle.checksum,
    rule
  };
}

function executionActionForRule(action: PolicyRuleAction, fallbackAction: PolicyRuleAction, signals: PolicySignalSet): AppliedPolicyDecision["executionAction"] {
  if (action === "block" || action === "require_approval") return "block";
  if (action === "warn") return "warn";
  if (action === "transform") {
    if (signals.redactionCount > 0 && signals.sanitizedTextAvailable) return "redact";
    if (fallbackAction === "block" || fallbackAction === "require_approval") return "block";
    if (fallbackAction === "warn") return "warn";
    return "allow";
  }

  return "allow";
}

function ruleMatches(rule: PolicyBundleRule, detectedCategories: string[], context: PolicyEvaluationContext) {
  const ruleCategories = new Set(rule.dataCategories.map((category) => category.toLowerCase()));
  const categoryMatch = detectedCategories.some((category) => ruleCategories.has(category.toLowerCase()));
  if (!categoryMatch) return false;

  return (
    scopeMatches(rule.aiProvider, context.aiProvider) &&
    destinationMatches(rule.destinationType, context.destinationType) &&
    scopeMatches(rule.userScope, context.userScope || "all") &&
    scopeMatches(rule.departmentScope, context.departmentScope || "all")
  );
}

function destinationMatches(ruleDestination: string, actualDestination: string) {
  return ruleDestination === "any" || ruleDestination === actualDestination;
}

function scopeMatches(ruleScope: string, actualScope: string) {
  const normalizedRule = ruleScope.trim().toLowerCase();
  const normalizedActual = actualScope.trim().toLowerCase();
  return !normalizedRule || normalizedRule === "all" || normalizedRule === "any" || normalizedRule === normalizedActual;
}

function explanationForDecision(rule: PolicyBundleRule, executionAction: AppliedPolicyDecision["executionAction"], detectedCategories: string[]) {
  const detected = detectedCategories.map((category) => category.replace(/_/g, " ")).join(", ");
  const doing =
    executionAction === "block"
      ? "blocking this submission"
      : executionAction === "redact"
        ? "transforming it with local redaction"
        : executionAction === "warn"
          ? "warning before submission"
          : "allowing the submission";

  return `Accord detected ${detected}. ${rule.sourcePolicyName} ${rule.sourceSection}: ${rule.employeeExplanation} Accord is ${doing}.`;
}

function allowDecision(detectedCategories: string[]): AppliedPolicyDecision {
  return {
    triggered: false,
    executionAction: "allow",
    policyAction: "allow",
    explanation: "No published company policy rule matched.",
    detectedCategories
  };
}

function hasEntity(entityCounts: EntityCountSummary, type: keyof EntityCountSummary) {
  return (entityCounts[type] || 0) > 0;
}

function severityWeight(severity?: string) {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}
