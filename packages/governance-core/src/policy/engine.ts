import type {
  InternalPolicyRule,
  PolicyAction,
  PolicyCandidateReason,
  PolicyConcept,
  PolicyDecisionExplanation,
  PolicyDetectorSignal,
  PolicyEvaluationInput,
  PolicyRuleEvaluation,
  ResolvedPolicyDecision,
  RetrievedPolicyCandidate
} from "./types";

const conceptPatterns: Record<PolicyConcept, RegExp[]> = {
  CLIENT_CONTEXT: [
    /\b(?:client|customer|owner|account holder|contact)\b/i,
    /\b(?:owned by|email them|call them|client record|owner information)\b/i
  ],
  VETERINARY_CASE: [
    /\b(?:veterinary|veterinarian|animal hospital|vet clinic|canine|feline|dog|cat|pet|patient)\b/i,
    /\b(?:diagnosis|treatment plan|discharge|lab result|clinical note|case note)\b/i
  ],
  VETERINARY_RECORD: [
    /\b(?:medical|veterinary|patient|case)\s+record\b/i,
    /\b(?:discharge notes?|diagnostic reports?|lab results?|treatment plans?|clinical notes?)\b/i
  ],
  FULL_VETERINARY_RECORD: [
    /\b(?:full|complete|entire)\s+(?:medical|veterinary|patient|case)(?:\s+(?:medical|veterinary|patient|case))?\s+record\b/i,
    /\b(?:medical|veterinary|patient|case)\s+record\b[\s\S]{0,80}\b(?:full|complete|entire)\b/i
  ],
  CONFIDENTIAL_BUSINESS: [
    /\b(?:confidential|non[- ]public|unreleased|proprietary|company internal|internal only)\b/i,
    /\b(?:do not distribute|not for distribution|restricted material)\b/i
  ],
  UNPUBLISHED_FINANCIALS: [
    /\b(?:unreleased|unpublished|non[- ]public|confidential|internal)\b[\s\S]{0,100}\b(?:forecast|projection|revenue|margin|financial result|operating result|earnings|budget)\b/i,
    /\b(?:forecast|projection|revenue|margin|financial result|operating result|earnings|budget)\b[\s\S]{0,100}\b(?:unreleased|unpublished|non[- ]public|confidential|internal)\b/i
  ],
  INTERNAL_STRATEGY: [
    /\b(?:internal|confidential|non[- ]public)\b[\s\S]{0,80}\b(?:strategy|expansion plan|acquisition plan|site plan|market entry|roadmap)\b/i,
    /\b(?:strategy|expansion plan|acquisition plan|site plan|market entry|roadmap)\b[\s\S]{0,80}\b(?:internal|confidential|non[- ]public)\b/i
  ],
  INTERNAL_PRICING: [
    /\b(?:internal|confidential|non[- ]public)\b[\s\S]{0,80}\b(?:pricing|price list|rate card|discount|margin model)\b/i,
    /\b(?:pricing|price list|rate card|discount|margin model)\b[\s\S]{0,80}\b(?:internal|confidential|non[- ]public)\b/i
  ],
  CONTRACT_VENDOR_TERMS: [
    /\b(?:confidential|internal|non[- ]public)\b[\s\S]{0,100}\b(?:contract|vendor terms?|commercial terms?|supplier agreement|negotiated rate)\b/i,
    /\b(?:contract|vendor terms?|commercial terms?|supplier agreement|negotiated rate)\b[\s\S]{0,100}\b(?:confidential|internal|non[- ]public)\b/i
  ],
  BOARD_EXECUTIVE_MATERIAL: [
    /\b(?:confidential|internal|non[- ]public)\b[\s\S]{0,80}\b(?:board deck|board material|executive memo|leadership briefing)\b/i,
    /\b(?:board deck|board material|executive memo|leadership briefing)\b[\s\S]{0,80}\b(?:confidential|internal|non[- ]public)\b/i
  ],
  INTERNAL_SECURITY_PROCEDURE: [
    /\b(?:internal|confidential|restricted)\b[\s\S]{0,80}\b(?:security procedure|incident response|network diagram|access procedure|security runbook)\b/i,
    /\b(?:security procedure|incident response|network diagram|access procedure|security runbook)\b[\s\S]{0,80}\b(?:internal|confidential|restricted)\b/i
  ],
  PROPRIETARY_TECHNICAL_DOCUMENTATION: [
    /\b(?:proprietary|internal|confidential)\b[\s\S]{0,80}\b(?:technical documentation|architecture|source code|system design|implementation detail)\b/i,
    /\b(?:technical documentation|architecture|source code|system design|implementation detail)\b[\s\S]{0,80}\b(?:proprietary|internal|confidential)\b/i
  ],
  EMPLOYEE_SENSITIVE_RECORD: [
    /\b(?:performance review|disciplinary|termination|salary|compensation|employee record|harassment investigation)\b/i,
    /\b(?:employee|candidate)\b[\s\S]{0,70}\b(?:performance|salary|compensation|disciplinary|termination|sensitive record)\b/i
  ],
  PUBLIC_INFORMATION: [
    /\b(?:publicly available|publicly released|public earnings|published research|press release|public filing|SEC filing|annual report|news report)\b/i,
    /\b(?:reported|announced|published|released)\b[\s\S]{0,60}\b(?:publicly|to the public|in its earnings report|in a press release)\b/i
  ]
};

const actionWeight: Record<PolicyAction, number> = {
  ALLOW: 1,
  REDACT: 2,
  HOLD: 3,
  BLOCK: 4
};

const severityWeight: Record<InternalPolicyRule["severity"], number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

export function detectPolicyConcepts(text: string): PolicyConcept[] {
  if (!text.trim()) return [];
  return (Object.entries(conceptPatterns) as Array<[PolicyConcept, RegExp[]]>)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([concept]) => concept);
}

export function retrievePolicyCandidates(rules: InternalPolicyRule[], input: PolicyEvaluationInput): RetrievedPolicyCandidate[] {
  const concepts = new Set(detectPolicyConcepts(input.text));
  const detectors = new Set(input.detectors);

  return rules
    .filter((rule) => rule.scope.enabled)
    .map((rule) => candidateForRule(rule, input.text, detectors, concepts))
    .filter((candidate): candidate is RetrievedPolicyCandidate => Boolean(candidate))
    .sort((a, b) => b.relevance - a.relevance || a.rule.id.localeCompare(b.rule.id));
}

export function evaluatePolicyRule(
  candidate: RetrievedPolicyCandidate,
  input: PolicyEvaluationInput,
  detectedConcepts = detectPolicyConcepts(input.text)
): PolicyRuleEvaluation {
  const rule = candidate.rule;
  const detectors = new Set(input.detectors);
  const concepts = new Set(detectedConcepts);
  const normalizedProvider = normalizeScopeValue(input.context.provider);
  const normalizedApp = normalizeScopeValue(input.context.app);
  const approvedProviders = new Set(input.context.approvedProviders.map(normalizeScopeValue));
  const reasons: string[] = [];

  if (!rule.scope.enabled) return rejected(rule, "rule_disabled");
  if (rule.scope.providers?.length && !rule.scope.providers.map(normalizeScopeValue).includes(normalizedProvider)) {
    return rejected(rule, "provider_not_in_scope");
  }
  if (rule.scope.blockedProviders?.map(normalizeScopeValue).includes(normalizedProvider) === false && rule.scope.blockedProviders?.length) {
    return rejected(rule, "provider_not_blocked_by_rule");
  }
  if (rule.scope.apps?.length && !rule.scope.apps.map(normalizeScopeValue).includes(normalizedApp)) {
    return rejected(rule, "app_not_in_scope");
  }
  if (rule.scope.userGroups?.length) {
    const actualGroups = new Set((input.context.userGroups || []).map(normalizeScopeValue));
    if (!rule.scope.userGroups.some((group) => actualGroups.has(normalizeScopeValue(group)))) return rejected(rule, "user_group_not_in_scope");
  }
  if (rule.scope.providerMode === "approved_only" && !approvedProviders.has(normalizedProvider)) {
    return rejected(rule, "provider_not_approved");
  }
  if (rule.scope.providerMode === "unapproved_only" && approvedProviders.has(normalizedProvider)) {
    return rejected(rule, "provider_is_approved");
  }

  const excludedConcept = rule.match.exclusions?.concepts?.find((concept) => concepts.has(concept));
  if (excludedConcept) return rejected(rule, `excluded_concept:${excludedConcept}`);
  const lowerText = input.text.toLocaleLowerCase();
  const excludedKeyword = rule.match.exclusions?.keywords?.find((keyword) => lowerText.includes(keyword.toLocaleLowerCase()));
  if (excludedKeyword) return rejected(rule, "excluded_keyword");

  if (rule.match.requireDetectors?.some((detector) => !detectors.has(detector))) return rejected(rule, "required_detector_missing");
  if (rule.match.requireDetectors?.length) reasons.push("required_detector_evidence");
  if (rule.match.anyDetectors?.length && !rule.match.anyDetectors.some((detector) => detectors.has(detector))) {
    return rejected(rule, "detector_evidence_missing");
  }
  if (rule.match.anyDetectors?.some((detector) => detectors.has(detector))) reasons.push("detector_evidence");

  if (rule.match.requireConcepts?.some((concept) => !concepts.has(concept))) return rejected(rule, "required_concept_missing");
  if (rule.match.requireConcepts?.length) reasons.push("required_concept_evidence");
  if (rule.match.anyConcepts?.length && !rule.match.anyConcepts.some((concept) => concepts.has(concept))) {
    return rejected(rule, "concept_evidence_missing");
  }
  if (rule.match.anyConcepts?.some((concept) => concepts.has(concept))) reasons.push("concept_evidence");

  const hasEnforcementEvidence = Boolean(
    rule.match.requireDetectors?.length ||
      rule.match.anyDetectors?.length ||
      rule.match.requireConcepts?.length ||
      rule.match.anyConcepts?.length
  );
  if (!hasEnforcementEvidence) return rejected(rule, "no_deterministic_enforcement_evidence");

  const action = rule.action === "REDACT" && !input.redactionAvailable ? rule.fallbackAction || "HOLD" : rule.action;
  if (action !== rule.action) reasons.push("redaction_unavailable_fallback");

  return { matched: true, rule, action, reasons };
}

export function evaluatePolicySet(rules: InternalPolicyRule[], input: PolicyEvaluationInput): ResolvedPolicyDecision {
  const detectedConcepts = detectPolicyConcepts(input.text);
  const candidates = retrievePolicyCandidates(rules, input);
  const matches = candidates
    .map((candidate) => evaluatePolicyRule(candidate, input, detectedConcepts))
    .filter((evaluation) => evaluation.matched)
    .sort(compareEvaluations);

  const primary = matches[0];
  if (!primary) {
    return {
      triggered: false,
      action: "ALLOW",
      matchedRuleIds: [],
      retrievedRuleIds: candidates.map((candidate) => candidate.rule.id),
      detectedConcepts
    };
  }

  return {
    triggered: true,
    action: primary.action,
    source: primary.rule.source.type,
    primaryRule: primary.rule,
    matchedRuleIds: matches.map((match) => match.rule.id),
    retrievedRuleIds: candidates.map((candidate) => candidate.rule.id),
    detectedConcepts,
    explanation: explanationFor(primary)
  };
}

function candidateForRule(
  rule: InternalPolicyRule,
  text: string,
  detectors: Set<PolicyDetectorSignal>,
  concepts: Set<PolicyConcept>
): RetrievedPolicyCandidate | null {
  const reasons: PolicyCandidateReason[] = [];
  for (const detector of [...(rule.match.requireDetectors || []), ...(rule.match.anyDetectors || [])]) {
    if (detectors.has(detector)) reasons.push({ type: "detector", value: detector, score: 1 });
  }
  for (const concept of [...(rule.match.requireConcepts || []), ...(rule.match.anyConcepts || [])]) {
    if (concepts.has(concept)) reasons.push({ type: "concept", value: concept, score: 0.9 });
  }
  const lowerText = text.toLocaleLowerCase();
  for (const keyword of rule.match.keywords || []) {
    if (lowerText.includes(keyword.toLocaleLowerCase())) reasons.push({ type: "keyword", value: keyword, score: 0.7 });
  }
  for (const example of rule.match.semanticExamples || []) {
    const score = localLexicalSimilarity(text, example);
    if (score >= 0.22) reasons.push({ type: "semantic_example", value: "policy_example", score });
  }

  if (!reasons.length) return null;
  const relevance = Math.min(1, reasons.reduce((sum, reason) => sum + reason.score, 0) / Math.min(3, reasons.length));
  return { rule, relevance, reasons };
}

function localLexicalSimilarity(left: string, right: string) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) overlap += 1;
  return overlap / Math.sqrt(leftTokens.size * rightTokens.size);
}

function tokenSet(value: string) {
  const stop = new Set(["a", "an", "and", "are", "for", "from", "in", "is", "it", "of", "on", "or", "the", "this", "to", "with"]);
  return new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((token) => token.length > 2 && !stop.has(token)));
}

function compareEvaluations(left: PolicyRuleEvaluation, right: PolicyRuleEvaluation) {
  return (
    actionWeight[right.action] - actionWeight[left.action] ||
    sourceWeight(right.rule) - sourceWeight(left.rule) ||
    severityWeight[right.rule.severity] - severityWeight[left.rule.severity] ||
    left.rule.id.localeCompare(right.rule.id)
  );
}

function sourceWeight(rule: InternalPolicyRule) {
  return rule.source.type === "organization_policy" ? 2 : 1;
}

function explanationFor(evaluation: PolicyRuleEvaluation): PolicyDecisionExplanation {
  const rule = evaluation.rule;
  return {
    source: rule.source.type,
    ruleId: rule.id,
    ruleTitle: rule.title,
    bundleName: rule.source.bundleName,
    severity: rule.severity,
    action: evaluation.action,
    reason: rule.explanation.user || rule.explanation.short,
    sourceReference: sourceReference(rule)
  };
}

function sourceReference(rule: InternalPolicyRule) {
  if (rule.source.type === "accord_builtin") return `Accord Built-in · ${rule.source.bundleName || rule.category}`;
  const document = rule.source.documentName || rule.source.bundleName || "Organization policy";
  return rule.source.section ? `${document} · ${rule.source.section}` : document;
}

function rejected(rule: InternalPolicyRule, rejectionReason: string): PolicyRuleEvaluation {
  return { matched: false, rule, action: "ALLOW", reasons: [], rejectionReason };
}

function normalizeScopeValue(value: string) {
  return value.trim().toLocaleLowerCase();
}
