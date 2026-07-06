import type { RiskState } from "./types";

const commonPersonFalsePositiveWords = new Set([
  "access",
  "accord",
  "api",
  "application",
  "base",
  "boss",
  "client",
  "code",
  "company",
  "customer",
  "data",
  "difference",
  "email",
  "encryption",
  "failed",
  "graphql",
  "instrumentation",
  "model",
  "planning",
  "plan",
  "professional",
  "request",
  "requests",
  "response",
  "rest",
  "reviewing",
  "search",
  "sentence",
  "server",
  "state",
  "structure",
  "support",
  "template",
  "transfer",
  "you"
]);

const productOrTechnicalWords = new Set([
  "accord",
  "api",
  "apis",
  "claude",
  "graphql",
  "javascript",
  "json",
  "openai",
  "python",
  "react",
  "rest",
  "sql",
  "typescript"
]);

const commonFirstNames = new Set(["alex", "alice", "bob", "jane", "john", "maria", "mary", "mike", "sarah", "wei"]);

export function detectRisk(input: string, sensitivity: string): RiskState {
  const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(input);
  const hasPhone = /(?<!\d)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(input);
  const hasSecret = /\b(?:sk-[A-Za-z0-9_-]{6,}|(?:api[_\s-]?key|secret|token|password)\s*[:=]\s*[A-Za-z0-9_.-]*[A-Za-z0-9_-]|[A-Za-z0-9_-]{32,})\b/i.test(input);
  const hasAddress = /\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4}\s+(?:Street|St\.|Avenue|Ave\.|Road|Rd\.|Boulevard|Blvd\.|Lane|Ln\.|Drive|Dr\.)\b/.test(input);
  const hasAccount = /\b(?:account|acct|routing|iban)\s*(?:number|no\.?|#|id)?\s*[:#]?\s*[A-Z0-9-]{4,}\b/i.test(input);
  const personCount = countLikelyPersonEntities(input);
  const hasFinancialContext = /loan|credit|denied|approval|mortgage|account|adverse action|underwriting/i.test(input);
  const hasLegalContext = /legal|contract|lawsuit|attorney|litigation|subpoena|settlement/i.test(input);
  const hasMedicalContext = /patient|diagnosis|medical|health|hipaa|prescription|therapy/i.test(input);
  const hasHrContext = /employee|termination|salary|candidate|hiring|workplace|harassment/i.test(input);
  const hasPromptInjection = /ignore (all )?(previous|prior) instructions|jailbreak|system prompt|developer mode|bypass safety|DAN/i.test(input);
  const hasCustomerCommunication = /email|customer|client|response|support/i.test(input);
  const sensitiveMode = sensitivity === "Confidential" || sensitivity === "Regulated";
  const detectedEntityCount =
    personCount + Number(hasEmail) + Number(hasPhone) + Number(hasSecret) + Number(hasAddress) + Number(hasAccount);
  const hasPii = detectedEntityCount > 0;

  const categories = [
    hasPii ? "Personal data" : null,
    hasFinancialContext ? "Regulated financial context" : null,
    hasLegalContext ? "Regulated legal context" : null,
    hasMedicalContext ? "Regulated medical context" : null,
    hasHrContext ? "Regulated HR context" : null,
    hasCustomerCommunication ? "Customer communication" : null,
    hasSecret ? "Secret or credential" : null,
    hasPromptInjection ? "Prompt injection attempt" : null,
    sensitiveMode ? `${sensitivity} workspace` : null
  ].filter(Boolean) as string[];

  const score = Math.min(98, 16 + categories.length * 14 + (hasSecret || hasPromptInjection ? 28 : 0));
  const decision = hasSecret || hasPromptInjection ? "Block" : hasPii ? "Redact" : score >= 54 ? "Warn" : "Allow";

  return {
    categories: categories.length ? categories : ["No elevated category"],
    decision,
    score: input.trim() ? score : 10,
    tone: decision === "Block" ? "critical" : decision === "Warn" || decision === "Redact" ? "warning" : "clear",
    detectedEntityCount
  };
}

function countLikelyPersonEntities(input: string) {
  const seen = new Set<string>();

  for (const match of execMatches(input, /(?=\b([A-Z][a-z][A-Za-z'-]{1,30}\s+[A-Z][a-z][A-Za-z'-]{1,30})\b)/g)) {
    const text = match[1];
    if (typeof match.index !== "number" || !text) continue;
    if (isLikelyPerson(text, input, match.index, match.index + text.length)) {
      seen.add(text.toLowerCase());
    }
  }

  for (const match of execMatches(
    input,
    /\b(?:to|from|for|named|name is|customer|client|employee|candidate|patient|email|message|write|draft|tell|contact)\s+([a-z][a-z'-]{1,30}\s+[a-z][a-z'-]{1,30})\b/g
  )) {
    if (typeof match.index !== "number" || !match[1]) continue;
    const nameOffset = match[0].toLowerCase().indexOf(match[1].toLowerCase());
    const start = match.index + Math.max(nameOffset, 0);
    if (isLikelyPerson(match[1], input, start, start + match[1].length)) {
      seen.add(match[1].toLowerCase());
    }
  }

  return seen.size;
}

function isLikelyPerson(text: string, fullText: string, start: number, end: number) {
  const words = text.split(/\s+/).map((word) => word.replace(/[^A-Za-z'-]/g, ""));
  const lowerWords = words.map((word) => word.toLowerCase());

  if (words.length !== 2) return false;
  if (lowerWords.some((word) => commonPersonFalsePositiveWords.has(word) || productOrTechnicalWords.has(word))) return false;
  if (/\b(?:my boss|my company|my project|you)\b/i.test(text)) return false;

  const before = fullText.slice(Math.max(0, start - 42), start).toLowerCase();
  const after = fullText.slice(end, Math.min(fullText.length, end + 56)).toLowerCase();
  const nearby = fullText.slice(Math.max(0, start - 70), Math.min(fullText.length, end + 70));
  const hasNameContext = /\b(?:to|from|for|tell|contact|reply to|email|message|write|draft|named|name is|dear|hi|hello|customer|client|patient|employee|candidate)\s+$/.test(before);
  const lowercaseName = words.every((word) => /^[a-z][a-z'-]*$/.test(word));
  if (lowercaseName && !commonFirstNames.has(lowerWords[0])) return false;

  const hasHumanAction = /^\s*(?:approved|emailed|called|said|asked|denied|requested|received|submitted|signed|needs|wants)\b/.test(after);
  const hasNearbyEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(nearby);
  const hasPersonRole = /\b(?:employee|candidate|patient|customer|client|manager|reviewer|approver)\b/i.test(nearby);

  return hasNameContext || hasHumanAction || hasNearbyEmail || hasPersonRole;
}

function execMatches(text: string, pattern: RegExp) {
  const matches: RegExpExecArray[] = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    matches.push(match);
    if (match[0] === "") pattern.lastIndex += 1;
  }

  return matches;
}
