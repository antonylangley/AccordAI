import { createHash } from "node:crypto";
import type { ImportedPolicyDestinationType, ImportedPolicyRiskLevel, ImportedPolicyRule, ImportedPolicyRuleAction } from "./types";

type CandidateSection = {
  heading: string;
  text: string;
  index: number;
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
  "do not",
  "never",
  "only",
  "redact",
  "remove",
  "de-identify",
  "deidentify",
  "confidential",
  "personal data",
  "sensitive",
  "regulated"
];

const categoryMatchers: Array<{ category: string; label: string; regex: RegExp }> = [
  { category: "client_identifying_info", label: "client identifying information", regex: /\b(client|customer|patient|candidate|employee)\b/i },
  { category: "personal_data", label: "personal data", regex: /\b(personal data|pii|personally identifiable|identifier|name|email|phone|address)\b/i },
  { category: "confidential_data", label: "confidential data", regex: /\b(confidential|internal only|non-public|sensitive)\b/i },
  { category: "regulated_financial_context", label: "regulated financial context", regex: /\b(financial|loan|bank|insurance|credit|investment|payment|account)\b/i },
  { category: "medical_context", label: "medical context", regex: /\b(medical|health|hipaa|clinical|patient|diagnosis|treatment)\b/i },
  { category: "hr_context", label: "HR context", regex: /\b(hr|human resources|candidate|recruiting|employee|performance|payroll)\b/i },
  { category: "legal_context", label: "legal context", regex: /\b(legal|privileged|attorney|contract|litigation|matter)\b/i },
  { category: "secrets_credentials", label: "secrets and credentials", regex: /\b(api key|secret|token|password|credential|private key)\b/i },
  { category: "source_code", label: "source code", regex: /\b(source code|repository|proprietary code|codebase)\b/i },
  { category: "intellectual_property", label: "intellectual property", regex: /\b(ip|intellectual property|trade secret|roadmap|proprietary)\b/i },
  { category: "prompt_injection", label: "prompt injection", regex: /\b(prompt injection|jailbreak|ignore previous|bypass|override instructions)\b/i }
];

export function inferPolicyRulesFromText(text: string, fileName: string): { rules: ImportedPolicyRule[]; warnings: string[] } {
  const warnings: string[] = [];
  const sourcePolicyName = titleFromFileName(fileName);
  const sections = splitIntoCandidateSections(text);
  const candidates = sections
    .map((section) => buildRuleFromSection(section, sourcePolicyName))
    .filter((rule): rule is ImportedPolicyRule => Boolean(rule))
    .sort((a, b) => b.confidence - a.confidence);

  const deduped = dedupeRules(candidates).slice(0, 8);

  if (!deduped.length) {
    warnings.push("No strong policy obligations were found. Try a document with explicit AI usage requirements, prohibitions, or approval rules.");
    deduped.push(buildGeneralAiUsageRule(text, sourcePolicyName));
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
    .slice(0, 80);
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

function buildRuleFromSection(section: CandidateSection, sourcePolicyName: string): ImportedPolicyRule | null {
  const text = section.text.trim();
  const lower = text.toLowerCase();
  const obligationScore = obligationWords.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
  const categories = categoriesForText(text);

  if (obligationScore === 0 && categories.length < 2) return null;

  const action = actionForText(text);
  const severity = severityForText(text, categories, action);
  const destinationType = destinationForText(text);
  const name = ruleNameForText(text, categories, action);
  const confidence = Math.min(96, 42 + obligationScore * 9 + categories.length * 7 + (action === "block" || action === "require_approval" ? 8 : 0));

  return {
    id: `import_${hashText(`${section.heading}:${text}`).slice(0, 10)}`,
    name,
    ruleKey: slugify(name).replace(/-/g, "_"),
    sourcePolicyName,
    sourceSection: section.heading || `Imported section ${Math.ceil(section.index)}`,
    supportingExcerpt: clampText(text, 1400),
    dataCategories: categories.length ? categories : ["ai_usage_policy"],
    userScope: "all",
    departmentScope: "all",
    aiProvider: providerForText(text),
    destinationType,
    action,
    fallbackAction: fallbackForAction(action),
    severity,
    employeeExplanation: explanationForRule(action, categories, destinationType),
    effectiveDate: new Date().toISOString().slice(0, 10),
    confidence
  };
}

function buildGeneralAiUsageRule(text: string, sourcePolicyName: string): ImportedPolicyRule {
  const excerpt = clampText(text.replace(/\s+/g, " ").trim(), 1400);

  return {
    id: `import_${hashText(excerpt || sourcePolicyName).slice(0, 10)}`,
    name: "Review imported AI policy before external AI use",
    ruleKey: "review_imported_ai_policy",
    sourcePolicyName,
    sourceSection: "Imported document",
    supportingExcerpt: excerpt || "Imported document did not contain enough readable text to infer specific rules.",
    dataCategories: ["ai_usage_policy"],
    userScope: "all",
    departmentScope: "all",
    aiProvider: "any",
    destinationType: "any",
    action: "warn",
    fallbackAction: "require_approval",
    severity: "medium",
    employeeExplanation: "Accord found a general AI usage policy. Review the imported text and refine this rule before publishing.",
    effectiveDate: new Date().toISOString().slice(0, 10),
    confidence: 35
  };
}

function categoriesForText(text: string) {
  const categories = categoryMatchers.filter((matcher) => matcher.regex.test(text)).map((matcher) => matcher.category);
  return Array.from(new Set(categories));
}

function actionForText(text: string): ImportedPolicyRuleAction {
  const lower = text.toLowerCase();
  if (/\b(block|prohibit|prohibited|must not|do not|never|forbidden)\b/.test(lower)) {
    if (/\b(redact|remove|de-identify|deidentify|mask|anonymize)\b/.test(lower)) return "transform";
    return "block";
  }
  if (/\b(approval|approved|permission|review required|human review)\b/.test(lower)) return "require_approval";
  if (/\b(redact|remove|de-identify|deidentify|mask|anonymize)\b/.test(lower)) return "transform";
  if (/\b(warn|notify|disclose)\b/.test(lower)) return "warn";
  return "warn";
}

function fallbackForAction(action: ImportedPolicyRuleAction): ImportedPolicyRuleAction {
  if (action === "transform") return "block";
  if (action === "warn") return "require_approval";
  return action;
}

function severityForText(text: string, categories: string[], action: ImportedPolicyRuleAction): ImportedPolicyRiskLevel {
  const lower = text.toLowerCase();
  if (/\b(api key|secret|password|private key|hipaa|payment|bank account|ssn|social security)\b/.test(lower)) return "critical";
  if (action === "block" || action === "require_approval") return categories.length >= 2 ? "high" : "medium";
  if (categories.some((category) => ["regulated_financial_context", "medical_context", "legal_context", "hr_context"].includes(category))) return "high";
  if (categories.length) return "medium";
  return "low";
}

function destinationForText(text: string): ImportedPolicyDestinationType {
  const lower = text.toLowerCase();
  if (/\b(personal|consumer|free account|public ai|unapproved)\b/.test(lower)) return "personal";
  if (/\b(unapproved|unauthorized)\b/.test(lower)) return "unapproved";
  if (/\b(approved|enterprise|company account|managed account)\b/.test(lower)) return "approved";
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

function ruleNameForText(text: string, categories: string[], action: ImportedPolicyRuleAction) {
  const firstCategory = categoryMatchers.find((matcher) => categories.includes(matcher.category))?.label;
  if (action === "transform" && firstCategory) return `Redact ${firstCategory} before external AI use`;
  if (action === "block" && firstCategory) return `Do not submit ${firstCategory} to unapproved AI`;
  if (action === "require_approval" && firstCategory) return `Require approval for ${firstCategory} in AI workflows`;
  if (firstCategory) return `Review ${firstCategory} before AI use`;

  const sentence = text.split(/[.!?]/)[0]?.trim() || "Imported AI usage policy";
  return clampText(sentence.replace(/^(employees|users|staff)\s+/i, ""), 84);
}

function explanationForRule(action: ImportedPolicyRuleAction, categories: string[], destinationType: ImportedPolicyDestinationType) {
  const categoryLabel = categories.length ? categories.map((category) => category.replace(/_/g, " ")).join(", ") : "policy-sensitive content";
  const destinationLabel = destinationType === "any" ? "external AI" : `${destinationType} AI`;

  if (action === "transform") {
    return `This policy requires ${categoryLabel} to be removed or masked before use with ${destinationLabel}.`;
  }
  if (action === "block") {
    return `This policy does not allow ${categoryLabel} to be submitted to ${destinationLabel}.`;
  }
  if (action === "require_approval") {
    return `This policy requires review or approval before ${categoryLabel} is used with ${destinationLabel}.`;
  }
  return `This policy requires caution when ${categoryLabel} appears in an AI workflow.`;
}

function dedupeRules(rules: ImportedPolicyRule[]) {
  const seen = new Set<string>();
  const deduped: ImportedPolicyRule[] = [];

  for (const rule of rules) {
    const key = `${rule.ruleKey}:${rule.action}:${rule.destinationType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(rule);
  }

  return deduped;
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
