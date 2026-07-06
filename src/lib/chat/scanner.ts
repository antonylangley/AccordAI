import "server-only";

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
  RedactionMap
} from "./types";

type RegulatedDetector = {
  type: ChatFlagType;
  label: string;
  severity: ChatFlagSeverity;
  pattern: RegExp;
  evidence: string;
};

type EntityCandidate = Omit<DetectedEntity, "id">;

type ScanOptions = {
  seedRedactionMap?: RedactionMap;
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
  "base",
  "best",
  "boss",
  "business",
  "case",
  "chat",
  "client",
  "code",
  "company",
  "contract",
  "customer",
  "dashboard",
  "data",
  "dear",
  "draft",
  "email",
  "encryption",
  "employee",
  "failed",
  "financial",
  "follow",
  "governance",
  "hello",
  "help",
  "instrumentation",
  "loan",
  "manager",
  "medical",
  "model",
  "notice",
  "planning",
  "policy",
  "product",
  "project",
  "out",
  "reaching",
  "request",
  "response",
  "review",
  "reviewing",
  "risk",
  "search",
  "support",
  "state",
  "system",
  "team",
  "template",
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
  "you"
]);

const knownCompanyOrProductWords = new Set([
  "accord",
  "anthropic",
  "chatgpt",
  "claude",
  "gemini",
  "google",
  "northstar",
  "openai"
]);

const commonFirstNames = new Set([
  "alex",
  "alice",
  "bob",
  "jane",
  "john",
  "maria",
  "mary",
  "mike",
  "sarah",
  "wei"
]);

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
  const candidates = detectEntityCandidates(text)
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
  const trimmed = candidate.originalText.trim();
  if (!trimmed) return null;

  if (candidate.type === "EMAIL") {
    return { ...candidate, originalText: trimmed, confidence: Math.max(candidate.confidence, 0.96) };
  }

  if (candidate.type === "SECRET") {
    return { ...candidate, originalText: trimmed, confidence: Math.max(candidate.confidence, 0.98) };
  }

  if (candidate.type === "PHONE") {
    const digits = trimmed.replace(/\D/g, "");
    const credible = digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
    const hasPhoneFormatting = /[\s().-]/.test(trimmed) || /^\+?1/.test(trimmed);
    if (!credible || !hasPhoneFormatting) return null;
    return { ...candidate, originalText: trimmed, confidence: Math.max(candidate.confidence, 0.9) };
  }

  if (candidate.type === "PERSON") {
    const words = trimmed.split(/\s+/).map((word) => word.replace(/[^A-Za-z'-]/g, ""));
    const lowerWords = words.map((word) => word.toLowerCase());

    if (words.length !== 2) return null;
    if (lowerWords.some((word) => commonPersonFalsePositiveWords.has(word))) return null;
    if (lowerWords.some((word) => knownCompanyOrProductWords.has(word))) return null;
    if (/\b(?:my boss|my company|my project|you)\b/i.test(trimmed)) return null;

    const contextSignals = Array.from(new Set([...candidate.contextSignals, ...getPersonContextSignals(fullText, candidate.start, candidate.end)]));
    const titleCase = words.every((word) => /^[A-Z][a-z][A-Za-z'-]*$/.test(word));
    const lowercaseContextName = words.every((word) => /^[a-z][a-z'-]*$/.test(word));

    if (lowercaseContextName && !isPlausibleLowercasePersonName(lowerWords)) return null;

    const confidence =
      candidate.confidence +
      (titleCase ? 0.05 : 0) +
      (lowercaseContextName ? 0.02 : 0) +
      contextSignals.reduce((score, signal) => score + personSignalWeight(signal), 0);

    if (confidence < entityThresholds.PERSON) return null;

    return {
      ...candidate,
      originalText: trimmed,
      confidence: Math.min(0.97, confidence),
      contextSignals
    };
  }

  if (candidate.confidence < entityThresholds[candidate.type]) return null;
  return { ...candidate, originalText: trimmed };
}

export function rehydrateResponse(responseText: string, redactionMap: RedactionMap): RehydrationResult {
  const unresolved = new Set<string>();
  let replacedCount = 0;

  const text = responseText.replace(/\[(?:PERSON|EMAIL|PHONE|ADDRESS|ACCOUNT|SECRET|OTHER)_\d+\]/g, (placeholder) => {
    const entity = redactionMap[placeholder];

    if (!entity || entity.type === "SECRET") {
      unresolved.add(placeholder);
      return placeholder;
    }

    replacedCount += 1;
    return entity.originalText;
  });

  return {
    text,
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

  if (hasSecret || hasPromptInjection) {
    return {
      action: "block",
      reason: hasSecret
        ? "Credential-like content is not sent to providers."
        : "Instruction-bypass language requires review before any provider call.",
      requiresReview: true,
      providerCalled: false,
      redacted: preflight.redactions.length > 0
    };
  }

  if (hasPii) {
    return {
      action: "redact",
      reason: "Personal data was detected and replaced with stable placeholders before provider routing.",
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
    ...detectPatternEntities(
      text,
      "SECRET",
      /\b(?:sk-[A-Za-z0-9_-]{6,}|(?:api[_\s-]?key|secret|token|password)\s*[:=]\s*[A-Za-z0-9_.-]*[A-Za-z0-9_-]|[A-Za-z0-9_-]{32,})\b/gi,
      0.98,
      "secret_regex"
    ),
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
    ...detectLowercaseContextPersonCandidates(text)
  ];
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

function detectCapitalizedPersonCandidates(text: string): EntityCandidate[] {
  const candidates: EntityCandidate[] = [];

  for (const match of execMatches(text, /(?=\b([A-Z][a-z][A-Za-z'-]{1,30}\s+[A-Z][a-z][A-Za-z'-]{1,30})\b)/g)) {
    if (typeof match.index !== "number") continue;
    const originalText = match[1];
    candidates.push({
      type: "PERSON",
      originalText,
      start: match.index,
      end: match.index + originalText.length,
      confidence: 0.62,
      detector: "capitalized_two_word_name",
      contextSignals: []
    });
  }

  return candidates;
}

function detectLowercaseContextPersonCandidates(text: string): EntityCandidate[] {
  const candidates: EntityCandidate[] = [];
  const pattern = /\b(?:to|from|for|named|name is|customer|client|employee|candidate|patient|email|message|write|draft)\s+([a-z][a-z'-]{1,30}\s+[a-z][a-z'-]{1,30})\b/g;

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

  if (/\b(?:to|from|for|tell|reply to|email|message|write|draft|named|name is|dear|hi|hello|customer|client|patient|employee|candidate)\s+$/.test(before)) {
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
    near_name_context: 0.18,
    near_human_action: 0.16,
    near_email: 0.14,
    near_person_role: 0.1
  };

  return weights[signal] || 0;
}

function isPlausibleLowercasePersonName(words: string[]) {
  return words.length === 2 && commonFirstNames.has(words[0]) && !commonPersonFalsePositiveWords.has(words[1]);
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

    if (candidateScore > existingScore) {
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
  return `${type}:${originalText.replace(/\s+/g, " ").trim().toLowerCase()}`;
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
