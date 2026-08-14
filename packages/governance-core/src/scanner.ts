import type {
  ChatFlagSeverity,
  ChatFlagType,
  ChatPolicyDecision,
  ChatRedaction,
  ChatRedactionType,
  ChatRiskFlag,
  ChatScanResult,
  ChatScanStage,
  DetectedEntity,
  EntityCountSummary,
  EntityType,
  ExternalEntityCandidate,
  RedactionMap
} from "./types";

type RegulatedDetector = {
  type: ChatFlagType;
  label: string;
  severity: ChatFlagSeverity;
  pattern: RegExp;
  evidence: string;
};

type EntityCandidate = ExternalEntityCandidate;

export type ScanOptions = {
  seedRedactionMap?: RedactionMap;
  additionalCandidates?: ExternalEntityCandidate[];
};

type RedactionResult = {
  text: string;
  redactions: ChatRedaction[];
  entities: DetectedEntity[];
  redactionMap: RedactionMap;
  entityCounts: EntityCountSummary;
};

export type RehydrationResult = {
  text: string;
  replacements: Array<{
    placeholder: string;
    type: EntityType;
    start: number;
    end: number;
  }>;
  replacedCount: number;
  unresolvedPlaceholderCount: number;
  unresolvedPlaceholders: string[];
};

const regulatedDetectors: RegulatedDetector[] = [
  {
    type: "regulated_financial",
    label: "Regulated financial context",
    severity: "high",
    pattern: /\b(?:loan|credit|mortgage|bank|account|underwriting|denied|adverse action|payment|investment|securities|insurance)\b/i,
    evidence: "Financial-services policy term detected."
  },
  {
    type: "regulated_legal",
    label: "Regulated legal context",
    severity: "high",
    pattern: /\b(?:lawsuit|contract|legal|attorney|privilege|litigation|subpoena|compliance|regulation|court|settlement)\b/i,
    evidence: "Legal or compliance term detected."
  },
  {
    type: "regulated_medical",
    label: "Regulated medical context",
    severity: "high",
    pattern: /\b(?:patient|diagnosis|treatment|medical|health|hipaa|prescription|clinical|hospital|therapy)\b/i,
    evidence: "Medical or health term detected."
  },
  {
    type: "regulated_hr",
    label: "Regulated HR context",
    severity: "high",
    pattern: /\b(?:employee|termination|salary|disciplinary|performance review|candidate|hiring|hr|workplace|harassment)\b/i,
    evidence: "HR or employment term detected."
  },
  {
    type: "prompt_injection",
    label: "Prompt injection attempt",
    severity: "critical",
    pattern:
      /\b(?:ignore (?:all )?(?:previous|prior) instructions|jailbreak|developer mode|system prompt|reveal (?:your|the) instructions|bypass safety|disable safety|do anything now|DAN)\b/i,
    evidence: "Instruction-bypass language detected."
  }
];

const severityWeights: Record<ChatFlagSeverity, number> = {
  low: 8,
  medium: 18,
  high: 28,
  critical: 48
};

const entityThresholds: Record<EntityType, number> = {
  PERSON: 0.74,
  EMAIL: 0.9,
  PHONE: 0.86,
  ADDRESS: 0.82,
  ACCOUNT: 0.82,
  SECRET: 0.95,
  OTHER: 0.8
};

const entityFlagConfig: Partial<
  Record<
    EntityType,
    {
      type: ChatFlagType;
      label: string;
      severity: ChatFlagSeverity;
      evidence: string;
    }
  >
> = {
  PERSON: {
    type: "possible_name",
    label: "Possible personal name",
    severity: "medium",
    evidence: "Validated name-like entity detected."
  },
  EMAIL: {
    type: "email",
    label: "Email address",
    severity: "medium",
    evidence: "Email-like pattern detected."
  },
  PHONE: {
    type: "phone",
    label: "Phone number",
    severity: "medium",
    evidence: "Phone-like pattern detected."
  },
  ADDRESS: {
    type: "address",
    label: "Address",
    severity: "medium",
    evidence: "Address-like pattern detected."
  },
  ACCOUNT: {
    type: "account",
    label: "Account identifier",
    severity: "high",
    evidence: "Account-like identifier detected."
  },
  SECRET: {
    type: "secret",
    label: "API key or secret",
    severity: "critical",
    evidence: "Credential-like pattern detected."
  }
};

const entityTypePriority: Record<EntityType, number> = {
  SECRET: 7,
  EMAIL: 6,
  PHONE: 5,
  ACCOUNT: 4,
  ADDRESS: 3,
  PERSON: 2,
  OTHER: 1
};

const commonPersonFalsePositiveWords = new Set([
  "a",
  "about",
  "access",
  "account",
  "accord",
  "action",
  "admin",
  "ai",
  "api",
  "application",
  "approval",
  "ask",
  "base",
  "best",
  "boss",
  "business",
  "birthday",
  "builder",
  "case",
  "candidate",
  "center",
  "chat",
  "claims",
  "client",
  "code",
  "company",
  "contact",
  "context",
  "contract",
  "compiler",
  "customer",
  "dashboard",
  "data",
  "dear",
  "defense",
  "defensive",
  "draft",
  "email",
  "encryption",
  "endpoint",
  "engineering",
  "employee",
  "failed",
  "family",
  "financial",
  "files",
  "follow",
  "folders",
  "friends",
  "governance",
  "graphql",
  "hello",
  "help",
  "human",
  "intelligence",
  "instrumentation",
  "invitations",
  "injection",
  "is",
  "less",
  "loan",
  "list",
  "manager",
  "management",
  "meeting",
  "message",
  "medical",
  "model",
  "motion",
  "my",
  "network",
  "notice",
  "null",
  "office",
  "operations",
  "patient",
  "platform",
  "planning",
  "plan",
  "policy",
  "portal",
  "product",
  "project",
  "provider",
  "prompt",
  "protocol",
  "records",
  "out",
  "query",
  "reaching",
  "react",
  "regex",
  "request",
  "report",
  "resources",
  "rest",
  "response",
  "review",
  "reviewing",
  "risk",
  "sales",
  "search",
  "security",
  "success",
  "support",
  "state",
  "stored",
  "system",
  "team",
  "technical",
  "template",
  "typescript",
  "admins",
  "users",
  "validator",
  "tell",
  "the",
  "to",
  "token",
  "transfer",
  "update",
  "up",
  "user",
  "write",
  "work",
  "workspace",
  "york",
  "you"
]);

const commonPersonFalsePositivePhrases = new Set([
  "accord guard",
  "artificial intelligence platform",
  "customer support team",
  "monday client meeting",
  "new york",
  "new york office",
  "openai api",
  "q3 risk review",
  "react state update",
  "representational state transfer"
]);

const knownCompanyOrProductWords = new Set([
  "accord",
  "anthropic",
  "api",
  "chat",
  "chatgpt",
  "claude",
  "gemini",
  "google",
  "northstar",
  "openai"
]);

const commonFirstNames = new Set([
  "alex",
  "aisha",
  "alice",
  "bob",
  "david",
  "jane",
  "jean-pierre",
  "joao",
  "joão",
  "john",
  "jose",
  "josé",
  "li",
  "ludwig",
  "maria",
  "maría",
  "mary",
  "mary-kate",
  "mike",
  "mohammed",
  "nguyễn",
  "saoirse",
  "sarah",
  "wei"
]);

const personParticles = new Set(["al", "bint", "bin", "da", "de", "del", "der", "di", "dos", "du", "la", "le", "van", "von"]);

const personTokenPattern = /[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu;

const humanListTrailingStopWords = new Set([
  "are",
  "arrived",
  "abt",
  "about",
  "after",
  "because",
  "before",
  "by",
  "called",
  "came",
  "can",
  "coming",
  "could",
  "is",
  "left",
  "next",
  "needs",
  "re",
  "regarding",
  "should",
  "that",
  "the",
  "to",
  "today",
  "tomorrow",
  "tonight",
  "was",
  "were",
  "will",
  "would"
]);

const humanListIntroducerPattern =
  /\b(?:(?:my|the|these|those|our)\s+)?(?:friends|people|recipients|invitees|attendees|employees|candidates|patients|reviewers|approvers|contacts|customers|clients|team\s+members|participants|guests|coworkers|colleagues)\b(?:\s+(?:are|include|includes))?|\b(?:invite(?:\s+(?:my\s+friends|these\s+people|the\s+attendees|the\s+recipients))?|send(?:\s+this)?\s+to|email(?:\s+the\s+recipients)?|copy|cc|message|contact|ask|tell|write\s+to|reply\s+to)\b/giu;

export function scanText(text: string, stage: ChatScanStage, sensitivity = "Internal", options: ScanOptions = {}): ChatScanResult {
  const redaction = redactTextWithSummary(text, options);
  const flags = dedupeFlags([
    ...buildEntityFlags(redaction.entities, stage),
    ...buildRegulatedFlags(text, stage)
  ]);
  const riskScore = calculateRiskScore(flags, sensitivity);

  return {
    stage,
    flags,
    riskScore,
    redactedText: redaction.text,
    redactions: redaction.redactions,
    entities: redaction.entities,
    redactionMap: redaction.redactionMap,
    entityCounts: redaction.entityCounts
  };
}

export function scanPolicyText(text: string, stage: ChatScanStage, sensitivity = "Internal"): ChatScanResult {
  const flags = dedupeFlags([
    ...buildDeterministicPolicyEntityFlags(text, stage),
    ...buildRegulatedFlags(text, stage)
  ]);
  const riskScore = calculateRiskScore(flags, sensitivity);

  return {
    stage,
    flags,
    riskScore,
    redactedText: text,
    redactions: [],
    entities: [],
    redactionMap: {},
    entityCounts: {}
  };
}

export function redactSensitiveText(text: string) {
  return redactTextWithSummary(text).text;
}

export function redactTextWithSummary(text: string, options: ScanOptions = {}): RedactionResult {
  const candidates = [...detectEntityCandidates(text), ...normalizeExternalCandidates(text, options.additionalCandidates)]
    .map((candidate) => validateEntityCandidate(candidate, text))
    .filter((candidate): candidate is EntityCandidate => Boolean(candidate))
    .sort((a, b) => a.start - b.start || entityTypePriority[b.type] - entityTypePriority[a.type] || b.confidence - a.confidence);
  const entities = assignStablePlaceholders(filterOverlappingCandidates(candidates), text, options.seedRedactionMap);
  const redactionMap = entities.reduce<RedactionMap>((map, entity) => {
    map[entity.id] = {
      type: entity.type,
      originalText: entity.originalText
    };
    return map;
  }, {});
  const redactions = uniqueRedactions(entities.map(entityToRedaction));
  const entityCounts = countEntities(entities);
  const redactedText = replaceEntities(text, entities);

  return {
    text: redactedText,
    redactions,
    entities,
    redactionMap,
    entityCounts
  };
}

export function validateEntityCandidate(candidate: EntityCandidate, fullText: string): EntityCandidate | null {
  const normalizedCandidate = trimCandidate(candidate);
  const trimmed = normalizedCandidate.originalText;
  if (!trimmed) return null;

  if (normalizedCandidate.type === "EMAIL") {
    return { ...normalizedCandidate, confidence: Math.max(normalizedCandidate.confidence, 0.96) };
  }

  if (normalizedCandidate.type === "SECRET") {
    return { ...normalizedCandidate, confidence: Math.max(normalizedCandidate.confidence, 0.98) };
  }

  if (normalizedCandidate.type === "PHONE") {
    const digits = trimmed.replace(/\D/g, "");
    const credible = digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
    const hasPhoneFormatting = /[\s().-]/.test(trimmed) || /^\+?1/.test(trimmed);
    if (!credible || !hasPhoneFormatting) return null;
    return { ...normalizedCandidate, confidence: Math.max(normalizedCandidate.confidence, 0.9) };
  }

  if (normalizedCandidate.type === "PERSON") {
    const tokens = getPersonTokens(trimmed);
    const lowerWords = tokens.map((token) => token.lower);
    const normalizedPhrase = normalizePhrase(trimmed);
    const nonParticleWords = lowerWords.filter((word) => !personParticles.has(word));

    if (tokens.length < 2 || tokens.length > 5) return null;
    if (!candidateTextMatchesTokens(trimmed, tokens)) return null;
    if (nonParticleWords.length < 2) return null;
    if (commonPersonFalsePositivePhrases.has(normalizedPhrase)) return null;
    if (lowerWords.some((word) => commonPersonFalsePositiveWords.has(word))) return null;
    if (lowerWords.some((word) => knownCompanyOrProductWords.has(word))) return null;
    if (/\b(?:my boss|my company|my project|you)\b/i.test(trimmed)) return null;

    const contextSignals = Array.from(
      new Set([...normalizedCandidate.contextSignals, ...getPersonContextSignals(fullText, normalizedCandidate.start, normalizedCandidate.end)])
    );
    const hasExternalPersonSignal =
      normalizedCandidate.detector.includes("ner") ||
      normalizedCandidate.detector.includes("person_detector") ||
      contextSignals.includes("ner_person") ||
      contextSignals.includes("local_person_candidate");
    const hasStrongLowercaseEvidence = contextSignals.some((signal) =>
      [
        "human_list_context",
        "human_action_context",
        "inherited_human_action_context",
        "coordinated_human_context",
        "comma_separated_human_list",
        "direct_human_recipient",
        "near_email",
        "conversation_stable"
      ].includes(signal)
    );
    const titleCase = tokens.every((token) => isCapitalizedNameToken(token.text) || personParticles.has(token.lower));
    const lowercaseContextName = tokens.every((token) => isLowercaseNameToken(token.text) || personParticles.has(token.lower));
    const hasParticle = lowerWords.some((word) => personParticles.has(word));
    const hasHumanContext = contextSignals.some((signal) =>
      [
        "near_name_context",
        "near_human_action",
        "near_email",
        "near_person_role",
        "conversation_stable",
        "human_list_context",
        "human_action_context",
        "inherited_human_action_context",
        "coordinated_human_context",
        "direct_human_recipient"
      ].includes(signal)
    );

    if (lowercaseContextName && !isPlausibleLowercasePersonName(lowerWords, hasStrongLowercaseEvidence) && !hasExternalPersonSignal) return null;
    if (!titleCase && !lowercaseContextName && !hasExternalPersonSignal) return null;

    const confidence =
      normalizedCandidate.confidence +
      (titleCase ? 0.05 : 0) +
      (lowercaseContextName ? 0.02 : 0) +
      (tokens.length > 2 ? 0.04 : 0) +
      (hasParticle ? 0.05 : 0) +
      (hasExternalPersonSignal ? 0.16 : 0) +
      (hasStrongLowercaseEvidence ? 0.08 : 0) +
      (hasHumanContext ? 0.04 : 0) +
      contextSignals.reduce((score, signal) => score + personSignalWeight(signal), 0);

    if (confidence < entityThresholds.PERSON) return null;

    return {
      ...normalizedCandidate,
      confidence: Math.min(0.97, confidence),
      contextSignals
    };
  }

  if (normalizedCandidate.confidence < entityThresholds[normalizedCandidate.type]) return null;
  return normalizedCandidate;
}

export function rehydrateResponse(responseText: string, redactionMap: RedactionMap): RehydrationResult {
  const unresolved = new Set<string>();
  const replacements: RehydrationResult["replacements"] = [];
  const pattern = /\[(?:PERSON|EMAIL|PHONE|ADDRESS|ACCOUNT|SECRET|OTHER)_\d+\]/g;
  let replacedCount = 0;
  let sourceCursor = 0;
  let text = "";

  for (const match of execMatches(responseText, pattern)) {
    if (typeof match.index !== "number") continue;
    const placeholder = match[0];
    const entity = redactionMap[placeholder];
    text += responseText.slice(sourceCursor, match.index);

    if (!entity || entity.type === "SECRET") {
      unresolved.add(placeholder);
      text += placeholder;
      sourceCursor = match.index + placeholder.length;
      continue;
    }

    const start = text.length;
    const end = start + entity.originalText.length;
    text += entity.originalText;
    replacements.push({
      placeholder,
      type: entity.type,
      start,
      end
    });
    replacedCount += 1;
    sourceCursor = match.index + placeholder.length;
  }

  text += responseText.slice(sourceCursor);

  return {
    text,
    replacements,
    replacedCount,
    unresolvedPlaceholderCount: unresolved.size,
    unresolvedPlaceholders: Array.from(unresolved)
  };
}

export function decidePolicy(preflight: ChatScanResult): ChatPolicyDecision {
  const hasSecret = hasFlag(preflight.flags, "secret");
  const hasPromptInjection = hasFlag(preflight.flags, "prompt_injection");
  const hasPii = hasAnyFlag(preflight.flags, ["email", "phone", "address", "account", "possible_name"]);
  const hasRegulatedContext = hasAnyFlag(preflight.flags, [
    "regulated_financial",
    "regulated_legal",
    "regulated_medical",
    "regulated_hr"
  ]);

  if (hasPromptInjection) {
    return {
      action: "block",
      reason: "Instruction-bypass language requires review before any provider call.",
      requiresReview: true,
      providerCalled: false,
      redacted: preflight.redactions.length > 0
    };
  }

  if (hasSecret || hasPii) {
    return {
      action: "redact",
      reason: hasSecret
        ? "Credential-like content was detected and removed locally before provider routing."
        : "Personal data was detected and replaced with stable placeholders before provider routing.",
      requiresReview: hasRegulatedContext,
      providerCalled: false,
      redacted: true
    };
  }

  if (hasRegulatedContext) {
    return {
      action: "warn",
      reason: "Regulated context was detected; metadata and redacted previews remain the default evidence.",
      requiresReview: true,
      providerCalled: false,
      redacted: false
    };
  }

  return {
    action: "allow",
    reason: "No elevated pre-flight policy issue detected.",
    requiresReview: false,
    providerCalled: false,
    redacted: false
  };
}

function detectEntityCandidates(text: string): EntityCandidate[] {
  return [
    ...detectPatternEntities(text, "EMAIL", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, 0.96, "email_regex"),
    ...detectPatternEntities(
      text,
      "PHONE",
      /(?<!\d)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
      0.9,
      "phone_regex"
    ),
    ...detectSecretCandidates(text),
    ...detectPatternEntities(
      text,
      "ADDRESS",
      /\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4}\s+(?:Street|St\.|Avenue|Ave\.|Road|Rd\.|Boulevard|Blvd\.|Lane|Ln\.|Drive|Dr\.)\b/g,
      0.86,
      "address_regex"
    ),
    ...detectPatternEntities(
      text,
      "ACCOUNT",
      /\b(?:account|acct|routing|iban)\s*(?:number|no\.?|#|id)?\s*[:#]?\s*[A-Z0-9-]{4,}\b/gi,
      0.86,
      "account_regex"
    ),
    ...detectCapitalizedPersonCandidates(text),
    ...detectHumanListPersonCandidates(text),
    ...detectLowercaseContextPersonCandidates(text)
  ];
}

function detectSecretCandidates(text: string): EntityCandidate[] {
  const patterns: Array<{ pattern: RegExp; detector: string }> = [
    { pattern: /\bsk-[A-Za-z0-9_-]{6,}\b/g, detector: "openai_key_regex" },
    { pattern: /\bAKIA[0-9A-Z]{16}\b/g, detector: "aws_access_key_regex" },
    { pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, detector: "github_token_regex" },
    { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, detector: "slack_token_regex" },
    { pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, detector: "jwt_regex" },
    { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/gi, detector: "bearer_token_regex" },
    {
      pattern: /\b(?:api[_\s-]?key|client[_\s-]?secret|access[_\s-]?token|auth[_\s-]?token|password|passwd)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{8,}["']?/gi,
      detector: "credential_assignment_regex"
    },
    {
      pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s@/]+@[^\s]+/gi,
      detector: "credential_uri_regex"
    },
    {
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
      detector: "private_key_regex"
    }
  ];

  return patterns.flatMap(({ pattern, detector }) => detectPatternEntities(text, "SECRET", pattern, 0.98, detector));
}

function detectPatternEntities(
  text: string,
  type: EntityType,
  pattern: RegExp,
  confidence: number,
  detector: string
): EntityCandidate[] {
  const candidates: EntityCandidate[] = [];

  for (const match of execMatches(text, pattern)) {
    if (typeof match.index !== "number") continue;
    candidates.push({
      type,
      originalText: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence,
      detector,
      contextSignals: []
    });
  }

  return candidates;
}

type PersonToken = {
  text: string;
  lower: string;
  start: number;
  end: number;
};

function normalizeExternalCandidates(text: string, candidates: ExternalEntityCandidate[] = []): EntityCandidate[] {
  return candidates
    .filter((candidate): candidate is ExternalEntityCandidate => {
      if (!candidate || !isKnownEntityType(candidate.type)) return false;
      if (!Number.isInteger(candidate.start) || !Number.isInteger(candidate.end)) return false;
      if (candidate.start < 0 || candidate.end <= candidate.start || candidate.end > text.length) return false;
      if (text.slice(candidate.start, candidate.end) !== candidate.originalText) return false;
      return Number.isFinite(candidate.confidence);
    })
    .map((candidate) => ({
      ...candidate,
      confidence: clamp(candidate.confidence, 0, 1),
      detector: candidate.detector || "external_candidate",
      contextSignals: Array.from(new Set(candidate.contextSignals || []))
    }));
}

function trimCandidate(candidate: EntityCandidate): EntityCandidate {
  const leading = candidate.originalText.match(/^\s*/)?.[0].length || 0;
  const trailing = candidate.originalText.match(/\s*$/)?.[0].length || 0;
  const start = candidate.start + leading;
  const end = candidate.end - trailing;

  return {
    ...candidate,
    originalText: candidate.originalText.slice(leading, candidate.originalText.length - trailing),
    start,
    end
  };
}

function collectPersonLikeTokens(text: string): PersonToken[] {
  const tokens: PersonToken[] = [];

  for (const match of execMatches(text, personTokenPattern)) {
    if (typeof match.index !== "number") continue;
    tokens.push({
      text: match[0],
      lower: normalizeNameToken(match[0]),
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return tokens;
}

function getPersonTokens(text: string): PersonToken[] {
  return collectPersonLikeTokens(text);
}

function tokensAreContiguousNameSpan(text: string, tokens: PersonToken[]) {
  for (let index = 1; index < tokens.length; index += 1) {
    if (!/^\s+$/.test(text.slice(tokens[index - 1].end, tokens[index].start))) return false;
  }

  return true;
}

function candidateTextMatchesTokens(text: string, tokens: PersonToken[]) {
  return tokensAreContiguousNameSpan(text, tokens) && normalizePhrase(text) === normalizePhrase(tokens.map((token) => token.text).join(" "));
}

function normalizePhrase(text: string) {
  return text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function debugPersonCandidateGenerationForTests(text: string) {
  return detectEntityCandidates(text)
    .filter((candidate) => candidate.type === "PERSON")
    .map((candidate) => ({
      text: candidate.originalText,
      start: candidate.start,
      end: candidate.end,
      source: candidate.detector,
      contextSignals: candidate.contextSignals
    }));
}

function normalizeNameToken(text: string) {
  return text.toLocaleLowerCase().replace(/[’]/g, "'");
}

function isCapitalizedNameToken(token: string) {
  const [first] = Array.from(token);
  if (!first) return false;
  return first === first.toLocaleUpperCase() && first !== first.toLocaleLowerCase() && !isAllUppercaseAcronym(token);
}

function isLowercaseNameToken(token: string) {
  const [first] = Array.from(token);
  if (!first) return false;
  return first === first.toLocaleLowerCase() && first !== first.toLocaleUpperCase();
}

function isAllUppercaseAcronym(token: string) {
  const letters = Array.from(token).filter((char) => /\p{L}/u.test(char));
  return letters.length > 1 && letters.every((char) => char === char.toLocaleUpperCase());
}

function isKnownEntityType(type: string): type is EntityType {
  return ["PERSON", "EMAIL", "PHONE", "ADDRESS", "ACCOUNT", "SECRET", "OTHER"].includes(type);
}

function detectCapitalizedPersonCandidates(text: string): EntityCandidate[] {
  const candidates: EntityCandidate[] = [];
  const tokens = collectPersonLikeTokens(text);

  for (let index = 0; index < tokens.length; index += 1) {
    for (let length = 2; length <= 5; length += 1) {
      const windowTokens = tokens.slice(index, index + length);
      if (windowTokens.length !== length) continue;
      if (!tokensAreContiguousNameSpan(text, windowTokens)) continue;
      if (!isCapitalizedNameToken(windowTokens[0].text)) continue;
      if (!isCapitalizedNameToken(windowTokens[windowTokens.length - 1].text)) continue;
      if (!windowTokens.every((token) => isCapitalizedNameToken(token.text) || personParticles.has(token.lower))) continue;

      const originalText = text.slice(windowTokens[0].start, windowTokens[windowTokens.length - 1].end);
      candidates.push({
        type: "PERSON",
        originalText,
        start: windowTokens[0].start,
        end: windowTokens[windowTokens.length - 1].end,
        confidence: 0.62 + (length > 2 ? 0.04 : 0),
        detector: length > 2 ? "capitalized_multi_token_name" : "capitalized_two_token_name",
        contextSignals: []
      });
    }
  }

  return candidates;
}

function detectHumanListPersonCandidates(text: string): EntityCandidate[] {
  const candidates: EntityCandidate[] = [];

  for (const match of execMatches(text, humanListIntroducerPattern)) {
    if (typeof match.index !== "number") continue;
    const listStart = skipListPrefix(text, match.index + match[0].length);
    const listEnd = findListSegmentEnd(text, listStart);
    if (listEnd <= listStart) continue;

    const segment = text.slice(listStart, listEnd);
    const items = splitHumanListItems(segment, listStart);
    const hasCoordination = items.length > 1 || /\b(?:and)\b|[,;]/iu.test(segment);

    for (const [index, item] of items.entries()) {
      const listSignals = [
        "human_list_context",
        index === 0 ? "human_action_context" : "inherited_human_action_context",
        ...(hasCoordination ? ["coordinated_human_context"] : []),
        ...(items.length > 1 ? ["comma_separated_human_list"] : [])
      ];
      const candidate = candidateFromListItem(text, item.start, item.end, listSignals);
      if (candidate) candidates.push(candidate);
    }
  }

  return uniqueCandidatesByRange(candidates);
}

function skipListPrefix(text: string, start: number) {
  let cursor = start;

  while (cursor < text.length && /[\s:=\[\("'`]/u.test(text[cursor])) {
    cursor += 1;
  }

  return cursor;
}

function findListSegmentEnd(text: string, start: number) {
  const maxEnd = Math.min(text.length, start + 220);
  for (let index = start; index < maxEnd; index += 1) {
    if (/[.!?]/u.test(text[index])) return index;
    if (text[index] === "]") return index;
  }

  return maxEnd;
}

function splitHumanListItems(segment: string, absoluteStart: number) {
  const items: Array<{ start: number; end: number }> = [];
  const separator = /\s*(?:,|;|\band\b)\s*/giu;
  let cursor = 0;

  for (const match of execMatches(segment, separator)) {
    if (typeof match.index !== "number") continue;
    items.push({ start: absoluteStart + cursor, end: absoluteStart + match.index });
    cursor = match.index + match[0].length;
  }

  items.push({ start: absoluteStart + cursor, end: absoluteStart + segment.length });

  return items.filter((item) => item.end > item.start);
}

function candidateFromListItem(text: string, start: number, end: number, contextSignals: string[]): EntityCandidate | null {
  const itemText = text.slice(start, end);
  let tokens = getPersonTokens(itemText).map((token) => ({
    ...token,
    start: token.start + start,
    end: token.end + start
  }));
  const trailingStopIndex = tokens.findIndex((token, index) => index >= 2 && humanListTrailingStopWords.has(token.lower));
  if (trailingStopIndex >= 2) {
    tokens = tokens.slice(0, trailingStopIndex);
  }

  if (tokens.length < 2 || tokens.length > 5) return null;
  if (!tokensAreContiguousNameSpan(text, tokens)) return null;

  const candidateStart = tokens[0].start;
  const candidateEnd = tokens[tokens.length - 1].end;
  const originalText = text.slice(candidateStart, candidateEnd);

  return {
    type: "PERSON",
    originalText,
    start: candidateStart,
    end: candidateEnd,
    confidence: 0.72,
    detector: contextSignals.includes("coordinated_human_context") ? "coordinated_human_sequence" : "human_list_context_name",
    contextSignals
  };
}

function uniqueCandidatesByRange(candidates: EntityCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.type}:${candidate.start}:${candidate.end}:${candidate.originalText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectLowercaseContextPersonCandidates(text: string): EntityCandidate[] {
  const candidates: EntityCandidate[] = [];
  const pattern =
    /\b(?:to|from|for|ask|named|name is|customer|client|employee|candidate|patient|email|message)\s+([\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)?\s+[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)?)\b/gu;

  for (const match of execMatches(text, pattern)) {
    if (typeof match.index !== "number" || !match[1]) continue;
    const nameOffset = match[0].toLowerCase().indexOf(match[1].toLowerCase());
    const start = match.index + Math.max(nameOffset, 0);
    candidates.push({
      type: "PERSON",
      originalText: match[1],
      start,
      end: start + match[1].length,
      confidence: 0.7,
      detector: "lowercase_context_name",
      contextSignals: ["near_name_context"]
    });
  }

  return candidates;
}

function getPersonContextSignals(fullText: string, start: number, end: number) {
  const before = fullText.slice(Math.max(0, start - 42), start).toLowerCase();
  const after = fullText.slice(end, Math.min(fullText.length, end + 56)).toLowerCase();
  const nearby = fullText.slice(Math.max(0, start - 70), Math.min(fullText.length, end + 70));
  const signals: string[] = [];

  if (/\b(?:to|from|for|ask|tell|reply to|email|message|write|draft|named|name is|dear|hi|hello|customer|client|patient|employee|candidate)\s+$/.test(before)) {
    signals.push("near_name_context");
  }

  if (/^\s*(?:approved|emailed|called|said|asked|denied|requested|received|submitted|signed|needs|wants)\b/.test(after)) {
    signals.push("near_human_action");
  }

  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(nearby)) {
    signals.push("near_email");
  }

  if (/\b(?:employee|candidate|patient|customer|client|manager|reviewer|approver)\b/i.test(nearby)) {
    signals.push("near_person_role");
  }

  return signals;
}

function personSignalWeight(signal: string) {
  const weights: Record<string, number> = {
    comma_separated_human_list: 0.08,
    conversation_stable: 0.24,
    coordinated_human_context: 0.1,
    detector_agreement: 0.12,
    direct_human_recipient: 0.14,
    human_action_context: 0.12,
    human_list_context: 0.22,
    inherited_human_action_context: 0.14,
    local_person_candidate: 0.12,
    near_name_context: 0.18,
    near_human_action: 0.16,
    near_email: 0.14,
    near_person_role: 0.1,
    ner_person: 0.16
  };

  return weights[signal] || 0;
}

function isPlausibleLowercasePersonName(words: string[], hasStrongLowercaseEvidence = false) {
  const nonParticleWords = words.filter((word) => !personParticles.has(word));
  const hasNegativeToken = nonParticleWords.some((word) => commonPersonFalsePositiveWords.has(word) || knownCompanyOrProductWords.has(word));
  if (hasNegativeToken || nonParticleWords.length < 2 || nonParticleWords.length > 3) return false;
  if (hasStrongLowercaseEvidence) return true;
  return commonFirstNames.has(nonParticleWords[0]);
}

function filterOverlappingCandidates(candidates: EntityCandidate[]) {
  const accepted: EntityCandidate[] = [];

  for (const candidate of candidates) {
    const overlapIndex = accepted.findIndex((entity) => rangesOverlap(candidate, entity));

    if (overlapIndex === -1) {
      accepted.push(candidate);
      continue;
    }

    const existing = accepted[overlapIndex];
    const candidateScore = entityTypePriority[candidate.type] * 2 + candidate.confidence;
    const existingScore = entityTypePriority[existing.type] * 2 + existing.confidence;
    const candidateLength = candidate.end - candidate.start;
    const existingLength = existing.end - existing.start;

    if (candidateScore > existingScore || (candidateScore === existingScore && candidateLength > existingLength)) {
      accepted[overlapIndex] = candidate;
    }
  }

  return accepted.sort((a, b) => a.start - b.start || a.end - b.end);
}

function assignStablePlaceholders(candidates: EntityCandidate[], text: string, seedRedactionMap: RedactionMap = {}): DetectedEntity[] {
  const counters = getSeedCounters(seedRedactionMap, text);
  const stableKeys = new Map<string, string>();

  for (const [placeholder, entity] of Object.entries(seedRedactionMap)) {
    stableKeys.set(buildStableKey(entity.type, entity.originalText), placeholder);
  }

  return candidates.map((candidate) => {
    const stableKey = buildStableKey(candidate.type, candidate.originalText);
    let placeholder = stableKeys.get(stableKey);

    if (!placeholder) {
      const next = (counters[candidate.type] || 0) + 1;
      counters[candidate.type] = next;
      placeholder = `[${candidate.type}_${next}]`;
      stableKeys.set(stableKey, placeholder);
    }

    return {
      id: placeholder,
      ...candidate
    };
  });
}

function getSeedCounters(seedRedactionMap: RedactionMap, text: string) {
  const counters = Object.keys(entityThresholds).reduce<Record<EntityType, number>>(
    (map, type) => ({
      ...map,
      [type]: 0
    }),
    {} as Record<EntityType, number>
  );

  for (const placeholder of Object.keys(seedRedactionMap)) {
    const parsed = parsePlaceholder(placeholder);
    if (parsed) counters[parsed.type] = Math.max(counters[parsed.type], parsed.index);
  }

  for (const match of execMatches(text, /\[(PERSON|EMAIL|PHONE|ADDRESS|ACCOUNT|SECRET|OTHER)_(\d+)\]/g)) {
    const type = match[1] as EntityType;
    const index = Number(match[2]);
    counters[type] = Math.max(counters[type], index);
  }

  return counters;
}

function replaceEntities(text: string, entities: DetectedEntity[]) {
  let result = "";
  let cursor = 0;

  for (const entity of entities) {
    result += text.slice(cursor, entity.start);
    result += entity.id;
    cursor = entity.end;
  }

  return result + text.slice(cursor);
}

function entityToRedaction(entity: DetectedEntity): ChatRedaction {
  return {
    type: entityTypeToRedactionType(entity.type),
    entityType: entity.type,
    placeholder: entity.id,
    confidence: Number(entity.confidence.toFixed(2)),
    detector: entity.detector,
    contextSignals: entity.contextSignals
  };
}

function uniqueRedactions(redactions: ChatRedaction[]) {
  const seen = new Set<string>();

  return redactions.filter((redaction) => {
    if (seen.has(redaction.placeholder)) return false;
    seen.add(redaction.placeholder);
    return true;
  });
}

function entityTypeToRedactionType(type: EntityType): ChatRedactionType {
  const map: Record<EntityType, ChatRedactionType> = {
    PERSON: "person",
    EMAIL: "email",
    PHONE: "phone",
    ADDRESS: "address",
    ACCOUNT: "account",
    SECRET: "secret",
    OTHER: "other"
  };

  return map[type];
}

function countEntities(entities: Pick<DetectedEntity, "type" | "id">[]): EntityCountSummary {
  const uniqueByPlaceholder = new Map(entities.map((entity) => [entity.id, entity.type]));
  const counts: EntityCountSummary = {};

  uniqueByPlaceholder.forEach((type) => {
    counts[type] = (counts[type] || 0) + 1;
  });

  return counts;
}

function buildEntityFlags(entities: DetectedEntity[], stage: ChatScanStage) {
  const seenTypes = new Set<EntityType>();

  return entities.reduce<ChatRiskFlag[]>((flags, entity) => {
    if (seenTypes.has(entity.type)) return flags;
    seenTypes.add(entity.type);
    const config = entityFlagConfig[entity.type];
    if (!config) return flags;

    return [
      ...flags,
      {
        type: config.type,
        label: config.label,
        severity: config.severity,
        stage,
        evidence: config.evidence
      }
    ];
  }, []);
}

function buildDeterministicPolicyEntityFlags(text: string, stage: ChatScanStage) {
  const deterministicEntities = detectEntityCandidates(text)
    .filter((candidate) => candidate.type !== "PERSON")
    .map((candidate) => validateEntityCandidate(candidate, text))
    .filter((candidate): candidate is EntityCandidate => Boolean(candidate));

  return buildEntityFlags(deterministicEntities.map((entity, index) => ({ id: `${entity.type}_${index}`, ...entity })), stage);
}

function buildRegulatedFlags(text: string, stage: ChatScanStage) {
  return regulatedDetectors.reduce<ChatRiskFlag[]>((matches, detector) => {
    detector.pattern.lastIndex = 0;
    if (!detector.pattern.test(text)) return matches;

    return [
      ...matches,
      {
        type: detector.type,
        label: detector.label,
        severity: detector.severity,
        stage,
        evidence: detector.evidence
      }
    ];
  }, []);
}

function calculateRiskScore(flags: ChatRiskFlag[], sensitivity: string) {
  const base = flags.reduce((score, flag) => score + severityWeights[flag.severity], 10);
  const sensitivityBoost = sensitivity === "Regulated" || sensitivity === "Confidential" ? 12 : 0;
  return Math.min(100, base + sensitivityBoost);
}

function dedupeFlags(flags: ChatRiskFlag[]) {
  const seen = new Set<string>();

  return flags.filter((flag) => {
    const key = `${flag.stage}:${flag.type}:${flag.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rangesOverlap(first: Pick<EntityCandidate, "start" | "end">, second: Pick<EntityCandidate, "start" | "end">) {
  return first.start < second.end && second.start < first.end;
}

function buildStableKey(type: EntityType, originalText: string) {
  const normalized = originalText.replace(/\s+/g, " ").trim();
  return `${type}:${type === "PERSON" ? normalized.toLocaleLowerCase() : normalized}`;
}

function parsePlaceholder(placeholder: string) {
  const match = placeholder.match(/^\[(PERSON|EMAIL|PHONE|ADDRESS|ACCOUNT|SECRET|OTHER)_(\d+)\]$/);
  if (!match) return null;

  return {
    type: match[1] as EntityType,
    index: Number(match[2])
  };
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

function hasFlag(flags: ChatRiskFlag[], type: ChatFlagType) {
  return flags.some((flag) => flag.type === type);
}

function hasAnyFlag(flags: ChatRiskFlag[], types: ChatFlagType[]) {
  return flags.some((flag) => types.includes(flag.type));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
