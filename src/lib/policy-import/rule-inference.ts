import { createHash } from "node:crypto";
import { recommendedActionToRuleAction, ruleActionToRecommendedAction } from "./enforceability";
import type {
  ImportedPolicyControlType,
  ImportedPolicyDestinationAuthorization,
  ImportedPolicyDestinationType,
  ImportedPolicyEnforceability,
  ImportedPolicyRecommendedAction,
  ImportedPolicyRiskLevel,
  ImportedPolicyRule,
  ImportedPolicyRuleAction
} from "./types";

type CandidateSection = {
  heading: string;
  text: string;
  index: number;
};

type CategoryMatcher = {
  category: string;
  label: string;
  regex: RegExp;
  deterministic: boolean;
};

const obligationWords = [
  "must",
  "must not",
  "should",
  "should not",
  "prohibit",
  "prohibited",
  "require",
  "required",
  "approval",
  "approved",
  "authorized",
  "do not",
  "never",
  "only",
  "unless",
  "except",
  "redact",
  "remove",
  "de-identify",
  "deidentify",
  "confidential",
  "personal data",
  "sensitive",
  "regulated"
];

const categoryMatchers: CategoryMatcher[] = [
  {
    category: "credentials",
    label: "credentials",
    regex: /\b(credentials?|secrets?|authentication tokens?)\b/i,
    deterministic: true
  },
  {
    category: "api_keys",
    label: "API keys",
    regex: /\b(api keys?|api tokens?|bearer tokens?|access tokens?)\b/i,
    deterministic: true
  },
  {
    category: "passwords",
    label: "passwords",
    regex: /\b(passwords?|passphrases?)\b/i,
    deterministic: true
  },
  {
    category: "private_keys",
    label: "private keys",
    regex: /\b(private keys?|ssh keys?|database urls?)\b/i,
    deterministic: true
  },
  {
    category: "phi",
    label: "PHI",
    regex: /\b(phi|protected health information|hipaa|patient health|medical records?|clinical notes?)\b/i,
    deterministic: true
  },
  {
    category: "pii",
    label: "PII",
    regex: /\b(pii|personally identifiable|personal data|personal information|identifiers?|names?|emails?|phone numbers?|addresses?|ssn|social security)\b/i,
    deterministic: true
  },
  {
    category: "financial_information",
    label: "financial information",
    regex: /\b(financial information|bank accounts?|payment cards?|credit cards?|loan applications?|tax records?|payroll records?)\b/i,
    deterministic: true
  },
  {
    category: "confidential_company_data",
    label: "confidential company data",
    regex: /\b(confidential company (?:information|data)|company confidential|confidential information|internal only|non-public|sensitive company|proprietary)\b/i,
    deterministic: false
  },
  {
    category: "source_code",
    label: "source code",
    regex: /\b(source code|repository|proprietary code|codebase|implementation details?)\b/i,
    deterministic: false
  },
  {
    category: "legal_documents",
    label: "legal documents",
    regex: /\b(legal documents?|contracts?|privileged materials?|attorney-client|litigation materials?)\b/i,
    deterministic: false
  },
  {
    category: "employment_records",
    label: "employment records",
    regex: /\b(employee records?|candidate records?|hr records?|performance reviews?|disciplinary records?|termination records?|compensation)\b/i,
    deterministic: true
  },
  {
    category: "customer_data",
    label: "customer data",
    regex: /\b(client|customer|patient|candidate|employee)\s+(?:data|records?|information|identifiers?)\b/i,
    deterministic: true
  }
];

const conditionalMarkers = /\b(unless|except|only if|approved for|authorized for|approved to process|authorized to process|when necessary)\b/i;

export function inferPolicyRulesFromText(text: string, fileName: string): { rules: ImportedPolicyRule[]; warnings: string[] } {
  const warnings: string[] = [];
  const sourcePolicyName = titleFromFileName(fileName);
  const sections = splitIntoCandidateSections(text);
  const candidates = sections
    .map((section) => buildRequirementFromSection(section, sourcePolicyName))
    .filter((rule): rule is ImportedPolicyRule => Boolean(rule))
    .sort(compareImportedRules);

  const deduped = dedupeRules(candidates).slice(0, 12);

  if (!deduped.length) {
    warnings.push("No strong policy obligations were found. Accord imported the document as policy guidance for admin review.");
    deduped.push(buildGeneralAiUsageGuidance(text, sourcePolicyName));
  }

  const guidanceOnlyCount = deduped.filter((rule) => rule.enforceability === "not_enforceable").length;
  if (guidanceOnlyCount) {
    warnings.push(
      `${guidanceOnlyCount} requirement${guidanceOnlyCount === 1 ? "" : "s"} classified as policy guidance only and not selected for prompt-layer enforcement by default.`
    );
  }

  return { rules: deduped, warnings };
}

function splitIntoCandidateSections(text: string): CandidateSection[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: CandidateSection[] = [];
  let heading = "Imported AI usage policy";
  let buffer: string[] = [];

  const flush = () => {
    const paragraph = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (paragraph) sections.push({ heading, text: paragraph, index: sections.length + 1 });
    buffer = [];
  };

  for (const line of lines) {
    if (looksLikeHeading(line)) {
      flush();
      heading = cleanHeading(line);
      continue;
    }

    if (line.length > 450) {
      flush();
      for (const sentence of splitSentences(line)) {
        sections.push({ heading, text: sentence, index: sections.length + 1 });
      }
      continue;
    }

    buffer.push(stripListMarker(line));
    if (buffer.join(" ").length > 700) flush();
  }

  flush();

  return sections
    .flatMap((section) => splitSectionOnPolicySentences(section))
    .filter((section) => section.text.length > 40)
    .slice(0, 100);
}

function splitSectionOnPolicySentences(section: CandidateSection) {
  const sentences = splitSentences(section.text);
  if (sentences.length <= 1) return [section];

  const policySentences = sentences.filter((sentence) => obligationWords.some((word) => sentence.toLowerCase().includes(word)));
  if (!policySentences.length) return [section];

  return policySentences.map((sentence, index) => ({
    heading: section.heading,
    text: sentence,
    index: section.index + index / 10
  }));
}

function buildRequirementFromSection(section: CandidateSection, sourcePolicyName: string): ImportedPolicyRule | null {
  const text = section.text.trim();
  const lower = text.toLowerCase();
  const obligationScore = obligationWords.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
  const controlType = controlTypeForText(text);
  const categories = categoriesForText(text, controlType);

  if (obligationScore === 0 && categories.length === 0 && controlType === "other") return null;

  const enforceability = enforceabilityForRequirement(text, controlType, categories);
  const destinationTypes = destinationTypesForText(text);
  const recommendedAction = recommendedActionForRequirement(text, controlType, enforceability);
  const action = recommendedActionToRuleAction(recommendedAction);
  const fallbackAction = fallbackForAction(action);
  const severity = severityForRequirement(text, categories, action, controlType);
  const provider = providerForText(text);
  const conditionDescription = conditionDescriptionForText(text, categories, destinationTypes, enforceability);
  const requirementSummary = requirementSummaryForText(text, controlType, categories);
  const name = ruleNameForRequirement(text, requirementSummary, categories, controlType, recommendedAction);
  const confidence = confidenceForRequirement(obligationScore, categories, controlType, enforceability, conditionDescription);

  return {
    id: `import_${hashText(`${section.heading}:${text}`).slice(0, 10)}`,
    name,
    ruleKey: slugify(name).replace(/-/g, "_"),
    sourceText: text,
    sourcePolicyName,
    sourceSection: section.heading || `Imported section ${Math.ceil(section.index)}`,
    supportingExcerpt: clampText(text, 1400),
    requirementSummary,
    controlType,
    enforceability,
    dataCategories: categories.length ? categories : fallbackCategoriesForControl(controlType),
    destinationTypes,
    userScope: "all",
    departmentScope: "all",
    aiProvider: provider,
    destinationType: primaryDestinationType(destinationTypes),
    recommendedAction,
    action,
    fallbackAction,
    severity,
    conditionDescription,
    employeeExplanation: employeeExplanationForRequirement(controlType, enforceability, action, categories, destinationTypes),
    reasoning: reasoningForRequirement(text, controlType, enforceability, categories, destinationTypes, recommendedAction),
    destinationAuthorizations: destinationAuthorizationsForText(text, provider, categories),
    effectiveDate: new Date().toISOString().slice(0, 10),
    confidence
  };
}

function buildGeneralAiUsageGuidance(text: string, sourcePolicyName: string): ImportedPolicyRule {
  const excerpt = clampText(text.replace(/\s+/g, " ").trim(), 1400);

  return {
    id: `import_${hashText(excerpt || sourcePolicyName).slice(0, 10)}`,
    name: "Guidance: review imported AI policy",
    ruleKey: "guidance_review_imported_ai_policy",
    sourceText: excerpt || "Imported document did not contain enough readable text to infer specific requirements.",
    sourcePolicyName,
    sourceSection: "Imported document",
    supportingExcerpt: excerpt || "Imported document did not contain enough readable text to infer specific requirements.",
    requirementSummary: "Review the imported policy text and decide which requirements can become Accord controls.",
    controlType: "procedural",
    enforceability: "not_enforceable",
    dataCategories: ["ai_usage_policy"],
    destinationTypes: ["any"],
    userScope: "all",
    departmentScope: "all",
    aiProvider: "any",
    destinationType: "any",
    recommendedAction: null,
    action: "allow",
    fallbackAction: "allow",
    severity: "low",
    conditionDescription: "No prompt-layer enforcement condition was inferred.",
    employeeExplanation: "Accord found general AI policy guidance. An admin should review it before creating any enforcement control.",
    reasoning: "The source text did not contain a concrete data-submission, redaction, secret-handling, or destination restriction that Accord can observe at the AI interaction layer.",
    destinationAuthorizations: [],
    effectiveDate: new Date().toISOString().slice(0, 10),
    confidence: 0.35
  };
}

function controlTypeForText(text: string): ImportedPolicyControlType {
  const lower = text.toLowerCase();

  if (isOutputUsageRequirement(lower)) return "output_usage";
  if (/\b(audit|log|monitor|report|record)\b/.test(lower) && !hasDataSubmissionIntent(lower)) return "monitoring";
  if (/\b(training|train employees|policy owner|governance process|documentation|documented|retention|review cadence)\b/.test(lower)) return "procedural";
  if (/\b(api keys?|secrets?|tokens?|passwords?|credentials?|private keys?)\b/.test(lower)) return "security_secret";
  if (/\b(redact|remove|de-identify|deidentify|mask|anonymize)\b/.test(lower)) return "data_redaction";
  if (/\b(tool|plugin|browser extension|code interpreter|connector)\b/.test(lower)) return "tool_usage";
  if (hasDataSubmissionIntent(lower) && hasDestinationLanguage(lower)) return "destination_restriction";
  if (hasDataSubmissionIntent(lower)) return "data_submission";
  if (/\b(human review|manual review|review required|approval|approved by|manager approval|legal approval)\b/.test(lower)) return "human_review";

  return "other";
}

function enforceabilityForRequirement(
  text: string,
  controlType: ImportedPolicyControlType,
  categories: string[]
): ImportedPolicyEnforceability {
  if (["output_usage", "human_review", "procedural", "monitoring", "other"].includes(controlType)) return "not_enforceable";
  if (requiresCategorySpecificAuthorization(text)) return "partially_enforceable";
  if (controlType === "tool_usage") return "partially_enforceable";
  if (!categories.length) return "partially_enforceable";

  const deterministicCategories = new Set(categoryMatchers.filter((matcher) => matcher.deterministic).map((matcher) => matcher.category));
  return categories.every((category) => deterministicCategories.has(category)) ? "fully_enforceable" : "partially_enforceable";
}

function categoriesForText(text: string, controlType: ImportedPolicyControlType) {
  if (controlType === "output_usage") return outputUsageCategoriesForText(text);

  const categories = categoryMatchers.filter((matcher) => matcher.regex.test(text)).map((matcher) => matcher.category);
  return Array.from(new Set(categories));
}

function outputUsageCategoriesForText(text: string) {
  const lower = text.toLowerCase();
  const categories = new Set<string>();

  if (/\b(ai[- ]generated information|ai-generated information|ai output|model output|generated information)\b/.test(lower)) {
    categories.add("ai_generated_information");
  }
  if (/\b(ai[- ]generated content|generated content|model response|ai response)\b/.test(lower)) {
    categories.add("ai_generated_content");
  }
  if (/\b(sole basis|clinical diagnosis|treatment recommendation|employment decision|legal determination|high-impact decision|high impact decision)\b/.test(lower)) {
    categories.add("high_impact_decision");
  }

  return Array.from(categories);
}

function fallbackCategoriesForControl(controlType: ImportedPolicyControlType) {
  if (controlType === "output_usage") return ["ai_generated_information"];
  if (controlType === "human_review") return ["human_review"];
  if (controlType === "procedural") return ["procedure"];
  if (controlType === "monitoring") return ["monitoring"];
  return ["ai_usage_policy"];
}

function recommendedActionForRequirement(
  text: string,
  controlType: ImportedPolicyControlType,
  enforceability: ImportedPolicyEnforceability
): ImportedPolicyRecommendedAction | null {
  if (enforceability === "not_enforceable") return null;

  const lower = text.toLowerCase();
  if (controlType === "data_redaction" || /\b(redact|remove|de-identify|deidentify|mask|anonymize)\b/.test(lower)) return "redact";
  if (/\b(block|prohibit|prohibited|must not|do not|never|forbidden|not be submitted|not submit)\b/.test(lower)) return "block";
  if (/\b(approval|approved by|permission|review required|human review)\b/.test(lower)) return "require_approval";
  if (/\b(warn|notify|disclose)\b/.test(lower)) return "warn";
  return "warn";
}

function fallbackForAction(action: ImportedPolicyRuleAction): ImportedPolicyRuleAction {
  if (action === "transform") return "block";
  if (action === "warn") return "require_approval";
  return action;
}

function severityForRequirement(
  text: string,
  categories: string[],
  action: ImportedPolicyRuleAction,
  controlType: ImportedPolicyControlType
): ImportedPolicyRiskLevel {
  const lower = text.toLowerCase();
  if (/\b(api key|secret|password|private key|hipaa|payment|bank account|ssn|social security|phi)\b/.test(lower)) return "critical";
  if (categories.some((category) => ["phi", "credentials", "api_keys", "passwords", "private_keys"].includes(category))) return "critical";
  if (categories.some((category) => ["financial_information", "employment_records", "legal_documents"].includes(category))) return "high";
  if (controlType === "output_usage" && categories.includes("high_impact_decision")) return "high";
  if (action === "block" || action === "require_approval") return categories.length >= 2 ? "high" : "medium";
  if (categories.length) return "medium";
  return "low";
}

function destinationTypesForText(text: string): ImportedPolicyDestinationType[] {
  const lower = text.toLowerCase();
  const destinations = new Set<ImportedPolicyDestinationType>();

  if (requiresCategorySpecificAuthorization(text)) destinations.add("unapproved");
  if (/\b(personal|consumer|free account|public ai|public generative ai)\b/.test(lower)) destinations.add("personal");
  if (/\b(unapproved|unauthorized|not approved|not authorized)\b/.test(lower)) destinations.add("unapproved");
  if (/\b(enterprise|company account|managed account)\b/.test(lower)) destinations.add("enterprise");
  if (!destinations.size && /\b(approved|authorized)\b/.test(lower)) destinations.add("approved");
  if (!destinations.size && /\b(external ai|external generative ai|generative ai services?|ai services?|ai tools?)\b/.test(lower)) destinations.add("any");

  return destinations.size ? Array.from(destinations) : ["any"];
}

function primaryDestinationType(destinations: ImportedPolicyDestinationType[]): ImportedPolicyDestinationType {
  for (const value of ["personal", "unapproved", "enterprise", "approved", "any"] as ImportedPolicyDestinationType[]) {
    if (destinations.includes(value)) return value;
  }
  return "any";
}

function providerForText(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("chatgpt")) return "chatgpt";
  if (lower.includes("openai")) return "openai";
  if (lower.includes("anthropic") || lower.includes("claude")) return "anthropic";
  if (lower.includes("gemini") || lower.includes("google ai")) return "gemini";
  return "any";
}

function requirementSummaryForText(text: string, controlType: ImportedPolicyControlType, categories: string[]) {
  const lower = text.toLowerCase();
  if (controlType === "output_usage" && /\b(accurate|accuracy|assumed to be accurate)\b/.test(lower)) {
    return "AI-generated information must be verified before employees rely on it.";
  }
  if (controlType === "output_usage" && /\bsole basis\b/.test(lower)) {
    return "AI-generated content must not be used as the sole basis for high-impact decisions.";
  }
  if (requiresCategorySpecificAuthorization(text)) {
    return `${categoryListLabel(categories)} may be submitted only to destinations approved for that data category.`;
  }

  const sentence = text.split(/[.!?]/)[0]?.trim() || "Imported AI policy requirement";
  return clampText(sentence, 180);
}

function ruleNameForRequirement(
  text: string,
  requirementSummary: string,
  categories: string[],
  controlType: ImportedPolicyControlType,
  recommendedAction: ImportedPolicyRecommendedAction | null
) {
  if (controlType === "output_usage") return `Guidance: ${clampText(requirementSummary.replace(/\.$/, ""), 72)}`;
  if (requiresCategorySpecificAuthorization(text)) return `Restrict ${categoryListLabel(categories)} to category-approved AI`;

  const firstCategory = categoryMatchers.find((matcher) => categories.includes(matcher.category))?.label;
  if (recommendedAction === "redact" && firstCategory) return `Redact ${firstCategory} before external AI use`;
  if (recommendedAction === "block" && firstCategory) return `Block ${firstCategory} for restricted AI destinations`;
  if (recommendedAction === "require_approval" && firstCategory) return `Require approval for ${firstCategory} in AI workflows`;
  if (firstCategory) return `Review ${firstCategory} before AI use`;

  return clampText(requirementSummary.replace(/^(employees|users|staff)\s+/i, ""), 84);
}

function conditionDescriptionForText(
  text: string,
  categories: string[],
  destinations: ImportedPolicyDestinationType[],
  enforceability: ImportedPolicyEnforceability
) {
  const condition = extractConditionText(text);

  if (requiresCategorySpecificAuthorization(text)) {
    return `Applies when the destination/provider is not approved for ${categoryListLabel(categories)}. Preserve source condition: ${condition || "approval must be specific to the data category."}`;
  }

  if (condition) return `Preserve source condition: ${condition}`;
  if (enforceability === "not_enforceable") return "No outgoing prompt-layer condition is observable by Accord.";

  return `Applies when Accord detects ${categoryListLabel(categories)} in content sent to ${destinations.map((item) => item.replace(/_/g, " ")).join(" or ")} AI destinations.`;
}

function employeeExplanationForRequirement(
  controlType: ImportedPolicyControlType,
  enforceability: ImportedPolicyEnforceability,
  action: ImportedPolicyRuleAction,
  categories: string[],
  destinations: ImportedPolicyDestinationType[]
) {
  if (enforceability === "not_enforceable") {
    if (controlType === "output_usage") {
      return "This requirement governs how AI output is used after generation. Accord records it as policy guidance instead of blocking outgoing prompts.";
    }
    return "This requirement is policy guidance for human process or review. Accord cannot directly enforce it at the outgoing prompt layer.";
  }

  const categoryLabel = categoryListLabel(categories);
  const destinationLabel = destinations.map((item) => item.replace(/_/g, " ")).join(" or ");

  if (action === "transform") {
    return `Accord should remove or mask ${categoryLabel} before content is sent to ${destinationLabel} AI destinations.`;
  }
  if (action === "block") {
    return `Accord should block ${categoryLabel} only when the destination condition is met for ${destinationLabel} AI.`;
  }
  if (action === "require_approval") {
    return `Accord should require approval before ${categoryLabel} is used with ${destinationLabel} AI.`;
  }
  return `Accord should warn employees when ${categoryLabel} appears in this AI workflow.`;
}

function reasoningForRequirement(
  text: string,
  controlType: ImportedPolicyControlType,
  enforceability: ImportedPolicyEnforceability,
  categories: string[],
  destinations: ImportedPolicyDestinationType[],
  recommendedAction: ImportedPolicyRecommendedAction | null
) {
  if (controlType === "output_usage") {
    return "The source clause governs reliance on or downstream use of AI output, not the content an employee submits to an AI provider. Converting it into prompt blocking would change the policy meaning.";
  }

  if (enforceability === "not_enforceable") {
    return "The requirement depends on employee judgment, workflow process, documentation, or post-output review rather than a condition Accord can observe in the AI interaction.";
  }

  if (requiresCategorySpecificAuthorization(text)) {
    return `The clause is enforceable only as a conditional destination control: ${categoryListLabel(categories)} is restricted when the provider is not approved for that category. It must not become a blanket block for all approved AI destinations.`;
  }

  return `The clause maps to a ${controlType.replace(/_/g, " ")} control because Accord can observe ${categoryListLabel(categories)} and destination scope ${destinations.join(", ")} at the AI interaction layer. Recommended action: ${
    recommendedAction || ruleActionToRecommendedAction("warn")
  }.`;
}

function destinationAuthorizationsForText(text: string, provider: string, categories: string[]): ImportedPolicyDestinationAuthorization[] {
  if (!requiresCategorySpecificAuthorization(text)) return [];

  return [
    {
      provider,
      destinationType: "approved",
      dataCategories: categories.length ? categories : ["policy_sensitive_data"],
      condition: extractConditionText(text) || "Destination/provider approval must be specific to each matched data category."
    }
  ];
}

function confidenceForRequirement(
  obligationScore: number,
  categories: string[],
  controlType: ImportedPolicyControlType,
  enforceability: ImportedPolicyEnforceability,
  conditionDescription: string
) {
  let confidence = 0.48 + Math.min(obligationScore, 5) * 0.06 + Math.min(categories.length, 4) * 0.05;
  if (controlType === "output_usage") confidence += 0.12;
  if (enforceability === "fully_enforceable") confidence += 0.1;
  if (enforceability === "not_enforceable") confidence += 0.08;
  if (conditionDescription.includes("Preserve source condition")) confidence += 0.04;
  return Math.min(0.96, Math.max(0.35, Number(confidence.toFixed(2))));
}

function compareImportedRules(left: ImportedPolicyRule, right: ImportedPolicyRule) {
  const enforceabilityWeight: Record<ImportedPolicyEnforceability, number> = {
    fully_enforceable: 3,
    partially_enforceable: 2,
    not_enforceable: 1
  };
  return (
    enforceabilityWeight[right.enforceability] - enforceabilityWeight[left.enforceability] ||
    right.confidence - left.confidence ||
    left.ruleKey.localeCompare(right.ruleKey)
  );
}

function dedupeRules(rules: ImportedPolicyRule[]) {
  const seen = new Set<string>();
  const deduped: ImportedPolicyRule[] = [];

  for (const rule of rules) {
    const key = `${rule.ruleKey}:${rule.enforceability}:${rule.controlType}:${rule.destinationType}:${rule.dataCategories.join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(rule);
  }

  return deduped;
}

function hasDataSubmissionIntent(lowerText: string) {
  return /\b(submit|submits|submitted|submitting|send|sent|sending|input|upload|paste|provide|disclose|enter|share|transmit)\b/.test(lowerText);
}

function hasDestinationLanguage(lowerText: string) {
  return /\b(external ai|external generative ai|generative ai services?|ai services?|ai tools?|approved|authorized|enterprise|managed account|personal|consumer|public ai|unapproved|unauthorized)\b/.test(
    lowerText
  );
}

function isOutputUsageRequirement(lowerText: string) {
  return (
    /\b(ai[- ]generated|model-generated|machine-generated|ai output|model output|generated content|generated information|ai response|model response)\b/.test(
      lowerText
    ) &&
    /\b(accurate|accuracy|assumed|rely|reliance|used as|sole basis|clinical diagnosis|treatment recommendation|employment decision|legal determination|high-impact decision|high impact decision)\b/.test(
      lowerText
    )
  );
}

function requiresCategorySpecificAuthorization(text: string) {
  return (
    conditionalMarkers.test(text) &&
    /\b(approved|authorized)\b/i.test(text) &&
    /\b(category|categories|type of information|class of information|that information|such information|process)\b/i.test(text)
  );
}

function extractConditionText(text: string) {
  const match = text.match(/\b(unless|except|only if|approved for|authorized for|approved to process|authorized to process|when necessary)\b[\s\S]*/i);
  return match ? clampText(match[0].replace(/\s+/g, " ").trim(), 260) : "";
}

function categoryListLabel(categories: string[]) {
  if (!categories.length) return "policy-sensitive data";
  return categories
    .map((category) => categoryMatchers.find((matcher) => matcher.category === category)?.label || category.replace(/_/g, " "))
    .join(", ");
}

function looksLikeHeading(line: string) {
  const clean = stripListMarker(line);
  if (clean.length < 3 || clean.length > 120) return false;
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(line)) return true;
  if (/^[A-Z][A-Z0-9 /&,-]{5,}$/.test(clean)) return true;
  return /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,7}:?$/.test(clean);
}

function cleanHeading(line: string) {
  return clampText(stripListMarker(line).replace(/:$/, ""), 120);
}

function stripListMarker(line: string) {
  return line.replace(/^(\d+(\.\d+)*[.)]?|[A-Za-z][.)]|[-*])\s+/, "").trim();
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function titleFromFileName(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return stem ? titleCase(stem) : "Imported AI Usage Policy";
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase());
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clampText(value: string, maxLength: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}...` : clean;
}
