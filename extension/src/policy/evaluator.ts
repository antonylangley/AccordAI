import { evaluatePolicySet, type EntityCountSummary, type PolicyDetectorSignal } from "@accord/governance-core";
import type { AppliedPolicyDecision, PolicyEvaluationContext, PolicySignalSet, PublishedPolicyBundle } from "./types";

export function evaluatePolicyBundle(
  bundle: PublishedPolicyBundle | null,
  signals: PolicySignalSet,
  context: PolicyEvaluationContext
): AppliedPolicyDecision {
  const detectedCategories = detectedPolicyCategories(signals);
  if (!bundle || !bundle.rules.length) return allowDecision(detectedCategories);

  const decision = evaluatePolicySet(bundle.rules, {
    text: signals.text,
    detectors: detectorSignals(signals),
    context: {
      ...context,
      approvedProviders: context.approvedProviders || bundle.approvedProviders
    },
    redactionAvailable: signals.redactionCount > 0 && signals.sanitizedTextAvailable
  });

  if (!decision.triggered || !decision.primaryRule || !decision.explanation) {
    return { ...allowDecision(detectedCategories), retrievedRuleIds: decision.retrievedRuleIds };
  }

  const executionAction = decision.action === "REDACT" ? "redact" : decision.action === "ALLOW" ? "allow" : "block";
  return {
    triggered: true,
    executionAction,
    policyAction: decision.action,
    explanation: `${decision.explanation.reason} Source: ${decision.explanation.sourceReference}.`,
    structuredExplanation: decision.explanation,
    detectedCategories: Array.from(new Set([...detectedCategories, ...decision.detectedConcepts.map((value) => value.toLowerCase())])).sort(),
    matchedRuleIds: decision.matchedRuleIds,
    retrievedRuleIds: decision.retrievedRuleIds,
    bundleId: bundle.id,
    bundleVersion: bundle.version,
    bundleChecksum: bundle.checksum,
    rule: decision.primaryRule
  };
}

export function detectedPolicyCategories(signals: Pick<PolicySignalSet, "flags" | "entityCounts">) {
  return detectorSignals(signals).map((value) => value.toLowerCase()).sort();
}

export function detectorSignals(signals: Pick<PolicySignalSet, "flags" | "entityCounts">): PolicyDetectorSignal[] {
  const detectors = new Set<PolicyDetectorSignal>();
  const entityCounts = signals.entityCounts || {};
  for (const entity of ["PERSON", "EMAIL", "PHONE", "ADDRESS", "ACCOUNT", "SECRET"] as const) {
    if (hasEntity(entityCounts, entity)) detectors.add(entity);
  }
  for (const flag of signals.flags) {
    if (flag.type === "email") detectors.add("EMAIL");
    if (flag.type === "phone") detectors.add("PHONE");
    if (flag.type === "address") detectors.add("ADDRESS");
    if (flag.type === "account") detectors.add("ACCOUNT");
    if (flag.type === "possible_name") detectors.add("PERSON");
    if (flag.type === "secret") detectors.add("SECRET");
    if (flag.type === "regulated_financial") detectors.add("REGULATED_FINANCIAL");
    if (flag.type === "regulated_legal") detectors.add("REGULATED_LEGAL");
    if (flag.type === "regulated_medical") detectors.add("REGULATED_MEDICAL");
    if (flag.type === "regulated_hr") detectors.add("REGULATED_HR");
  }
  return Array.from(detectors).sort();
}

function allowDecision(detectedCategories: string[]): AppliedPolicyDecision {
  return {
    triggered: false,
    executionAction: "allow",
    policyAction: "ALLOW",
    explanation: "No published company or built-in policy rule matched.",
    detectedCategories,
    matchedRuleIds: [],
    retrievedRuleIds: []
  };
}

function hasEntity(entityCounts: EntityCountSummary, type: keyof EntityCountSummary) {
  return (entityCounts[type] || 0) > 0;
}
