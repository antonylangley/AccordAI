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
  PERSON: 0.5,
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
  const candidates = [
    ...detectEntityCandidates(text),
    ...normalizeExternalCandidates(text, options.additionalCandidates)
  ]
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

export function validateEntityCandidate(candidate: EntityCandidate, _fullText: string): EntityCandidate | null {
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
    const isNeuralCandidate =
      /^accord_ner_v\d+(?:_\d+)*$/i.test(normalizedCandidate.detector) ||
      normalizedCandidate.contextSignals.includes("ner_person");

    if (!isNeuralCandidate || normalizedCandidate.confidence < entityThresholds.PERSON) return null;
    if (tokens.length < 1 || tokens.length > 6) return null;
    if (!candidateTextMatchesTokens(trimmed, tokens)) return null;
    return normalizedCandidate;
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
    )
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

const personTokenPattern = /[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu;

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
      lower: match[0].toLocaleLowerCase().replace(/[’]/g, "'"),
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

function isKnownEntityType(type: string): type is EntityType {
  return ["PERSON", "EMAIL", "PHONE", "ADDRESS", "ACCOUNT", "SECRET", "OTHER"].includes(type);
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
