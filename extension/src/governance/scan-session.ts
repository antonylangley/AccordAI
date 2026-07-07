import { decidePolicy, rehydrateResponse, scanText } from "@accord/governance-core";
import type { ChatPolicyDecision, ChatRedaction, ChatScanResult, DetectedEntity, EntityCountSummary, RedactionMap } from "@accord/governance-core";
import type {
  MoveVaultPayload,
  RehydrateResponsePayload,
  RehydrateSafeResult,
  SafeScanResult,
  ScanDraftPayload
} from "../messaging/types";
import { PlaceholderVault } from "./placeholder-vault";

const vault = new PlaceholderVault();

export async function scanDraft(payload: ScanDraftPayload): Promise<SafeScanResult> {
  const seedRedactionMap = await vault.load(payload.surface, payload.conversationKey);
  const scan = scanText(payload.text, "preflight", payload.sensitivity || "Internal", {
    seedRedactionMap
  });
  const stabilizedScan = applyConversationStableRedactions(payload.text, scan, seedRedactionMap);
  const decision = decidePolicy(stabilizedScan);

  if (payload.authoritative && decision.action !== "block") {
    await vault.merge(payload.surface, payload.conversationKey, stabilizedScan.redactionMap);
  }

  return toSafeScanResult(stabilizedScan, decision, payload.includeSanitizedText);
}

export async function rehydrateAssistantText(payload: RehydrateResponsePayload): Promise<RehydrateSafeResult> {
  const redactionMap = await vault.load(payload.surface, payload.conversationKey);
  const result = rehydrateResponse(payload.text, redactionMap);

  return {
    text: result.text,
    replacedCount: result.replacedCount,
    unresolvedPlaceholderCount: result.unresolvedPlaceholderCount
  };
}

export function moveVault(payload: MoveVaultPayload) {
  return vault.move(payload);
}

function toSafeScanResult(scan: ChatScanResult, decision: ChatPolicyDecision, includeSanitizedText: boolean): SafeScanResult {
  const detectedEntityCount = scan.redactions.length;

  return {
    scanId: crypto.randomUUID(),
    action: decision.action,
    riskScore: scan.riskScore,
    riskLevel: riskLevel(scan.riskScore),
    detectedEntityCount,
    entityCounts: scan.entityCounts,
    decorations: scan.entities.map((entity) => ({
      type: entity.type,
      start: entity.start,
      end: entity.end,
      placeholder: entity.id
    })),
    flags: scan.flags.map((flag) => ({
      type: flag.type,
      label: flag.label,
      severity: flag.severity,
      stage: flag.stage,
      evidence: flag.evidence
    })),
    explanation: buildExplanation(decision, detectedEntityCount),
    sanitizedText: includeSanitizedText ? scan.redactedText : undefined
  };
}

function riskLevel(score: number): SafeScanResult["riskLevel"] {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function buildExplanation(decision: ChatPolicyDecision, detectedEntityCount: number) {
  if (decision.action === "block") {
    return decision.reason || "Possible credential or unsafe instruction detected. This message cannot be sent.";
  }

  if (decision.action === "redact") {
    return `${detectedEntityCount} identifier${detectedEntityCount === 1 ? "" : "s"} will be redacted before sending.`;
  }

  if (decision.action === "warn") {
    return decision.reason || "Policy-sensitive context detected.";
  }

  return "No elevated policy issue detected.";
}

function applyConversationStableRedactions(text: string, scan: ChatScanResult, seedRedactionMap: RedactionMap): ChatScanResult {
  const knownEntities = findKnownEntities(text, seedRedactionMap);
  if (!knownEntities.length) return scan;

  const combinedEntities = mergeEntities(scan.entities, knownEntities);
  const redactions = uniqueRedactions([
    ...scan.redactions,
    ...knownEntities.map(
      (entity): ChatRedaction => ({
        type: entity.type.toLowerCase() as ChatRedaction["type"],
        entityType: entity.type,
        placeholder: entity.id,
        confidence: 1,
        detector: "conversation_vault_exact",
        contextSignals: ["conversation_stable"]
      })
    )
  ]);

  return {
    ...scan,
    redactedText: replaceEntities(text, combinedEntities),
    redactions,
    entities: combinedEntities,
    redactionMap: {
      ...seedRedactionMap,
      ...scan.redactionMap
    },
    entityCounts: countEntities(combinedEntities),
    flags: dedupeFlags([...scan.flags, ...knownEntities.map((entity) => entityToFlag(entity, scan.stage))]),
    riskScore: Math.max(scan.riskScore, 40)
  };
}

function findKnownEntities(text: string, seedRedactionMap: RedactionMap): DetectedEntity[] {
  const entities: DetectedEntity[] = [];

  for (const [placeholder, entity] of Object.entries(seedRedactionMap)) {
    if (entity.type === "SECRET" || !entity.originalText) continue;

    for (const range of findLiteralRanges(text, entity.originalText)) {
      entities.push({
        id: placeholder,
        type: entity.type,
        originalText: entity.originalText,
        start: range.start,
        end: range.end,
        confidence: 1,
        detector: "conversation_vault_exact",
        contextSignals: ["conversation_stable"]
      });
    }
  }

  return entities;
}

function findLiteralRanges(text: string, literal: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "gi");

  for (const match of text.matchAll(pattern)) {
    if (typeof match.index !== "number") continue;
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  return ranges;
}

function mergeEntities(primary: DetectedEntity[], secondary: DetectedEntity[]) {
  const entities = [...primary];

  for (const entity of secondary) {
    if (!entities.some((existing) => rangesOverlap(existing, entity))) {
      entities.push(entity);
    }
  }

  return entities.sort((a, b) => a.start - b.start || a.end - b.end);
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

function countEntities(entities: DetectedEntity[]): EntityCountSummary {
  const uniqueByPlaceholder = new Map(entities.map((entity) => [entity.id, entity.type]));
  const counts: EntityCountSummary = {};

  for (const type of uniqueByPlaceholder.values()) {
    counts[type] = (counts[type] || 0) + 1;
  }

  return counts;
}

function uniqueRedactions(redactions: ChatRedaction[]) {
  const seen = new Set<string>();

  return redactions.filter((redaction) => {
    const key = redaction.placeholder;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function entityToFlag(entity: DetectedEntity, stage: ChatScanResult["stage"]): ChatScanResult["flags"][number] {
  const labels = {
    PERSON: ["possible_name", "Possible personal name", "medium"],
    EMAIL: ["email", "Email address", "medium"],
    PHONE: ["phone", "Phone number", "medium"],
    ADDRESS: ["address", "Address", "medium"],
    ACCOUNT: ["account", "Account identifier", "high"],
    SECRET: ["secret", "API key or secret", "critical"],
    OTHER: ["possible_name", "Personal data", "medium"]
  } as const;
  const [type, label, severity] = labels[entity.type];

  return {
    type,
    label,
    severity,
    stage,
    evidence: "Known conversation placeholder entity detected."
  };
}

function dedupeFlags(flags: ChatScanResult["flags"]) {
  const seen = new Set<string>();

  return flags.filter((flag) => {
    const key = `${flag.stage}:${flag.type}:${flag.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rangesOverlap(first: Pick<DetectedEntity, "start" | "end">, second: Pick<DetectedEntity, "start" | "end">) {
  return first.start < second.end && second.start < first.end;
}
