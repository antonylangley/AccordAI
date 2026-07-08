import { decidePolicy, rehydrateResponse, scanText } from "@accord/governance-core";
import type {
  ChatPolicyDecision,
  ChatRedaction,
  ChatScanResult,
  DetectedEntity,
  EntityCountSummary,
  EntityType,
  RedactionMap
} from "@accord/governance-core";
import {
  classifyAttachmentContent,
  getFileExtension,
  MAX_GUARDED_TEXT_ATTACHMENT_BYTES,
  mimeCategory,
  safeMimeType,
  splitFileName
} from "../attachments/policy";
import type {
  GovernAttachmentsPayload,
  GovernAttachmentsResult,
  GovernedAttachmentAction,
  GovernedAttachmentResult,
  GuardAttachmentInput,
  MoveVaultPayload,
  RehydrateResponsePayload,
  RehydrateSafeResult,
  SafeScanResult,
  ScanDraftPayload
} from "../messaging/types";
import { detectPersonCandidates, type PersonDetectionCoverage } from "../person-detection/person-detector";
import { PlaceholderVault } from "./placeholder-vault";

const vault = new PlaceholderVault();

export async function scanDraft(payload: ScanDraftPayload): Promise<SafeScanResult> {
  const seedRedactionMap = await vault.load(payload.surface, payload.conversationKey);
  const { scan, personDetection } = await runGovernanceScan(payload.text, "preflight", payload.sensitivity || "Internal", seedRedactionMap);
  const stabilizedScan = applyConversationStableRedactions(payload.text, scan, seedRedactionMap);
  const decision = decidePolicy(stabilizedScan);

  if (payload.authoritative && decision.action !== "block") {
    await vault.merge(payload.surface, payload.conversationKey, stabilizedScan.redactionMap);
  }

  return toSafeScanResult(stabilizedScan, decision, payload.includeSanitizedText, personDetection);
}

export async function governAttachmentBatch(payload: GovernAttachmentsPayload): Promise<GovernAttachmentsResult> {
  let workingRedactionMap = await vault.load(payload.surface, payload.conversationKey);
  const results: GovernedAttachmentResult[] = [];
  const acceptedMaps: RedactionMap[] = [];

  for (const attachment of payload.attachments) {
    const { result, redactionMap } = await governSingleAttachment(attachment, payload, workingRedactionMap);
    results.push(result);

    if (result.action === "clean" || result.action === "redacted") {
      if (redactionMap && Object.keys(redactionMap).length) {
        acceptedMaps.push(redactionMap);
        workingRedactionMap = {
          ...workingRedactionMap,
          ...redactionMap
        };
      }
    }
  }

  const hasFailure = results.some((result) => !["clean", "redacted"].includes(result.action));

  if (hasFailure) {
    return {
      batchAction: "block",
      results: results.map((result) => ({ ...result, sanitizedText: undefined })),
      summary: firstBlockingSummary(results)
    };
  }

  const mergedMap = Object.assign({}, ...acceptedMaps);
  if (Object.keys(mergedMap).length) {
    await vault.merge(payload.surface, payload.conversationKey, mergedMap);
  }

  return {
    batchAction: "allow",
    results,
    summary: buildAttachmentSummary(results)
  };
}

export async function rehydrateAssistantText(payload: RehydrateResponsePayload): Promise<RehydrateSafeResult> {
  const redactionMap = await vault.load(payload.surface, payload.conversationKey);
  const result = rehydrateResponse(payload.text, redactionMap);

  return {
    resolvedText: result.text,
    replacements: result.replacements,
    resolvedCount: result.replacedCount,
    unresolvedPlaceholders: result.unresolvedPlaceholders,
    text: result.text,
    replacedCount: result.replacedCount,
    unresolvedPlaceholderCount: result.unresolvedPlaceholderCount
  };
}

export function moveVault(payload: MoveVaultPayload) {
  return vault.move(payload);
}

async function governSingleAttachment(
  attachment: GuardAttachmentInput,
  payload: GovernAttachmentsPayload,
  seedRedactionMap: RedactionMap
): Promise<{ result: GovernedAttachmentResult; redactionMap?: RedactionMap }> {
  const extension = getFileExtension(attachment.originalName);
  const base = {
    id: attachment.id,
    extension,
    mimeType: safeMimeType(attachment.mimeType, attachment.originalName),
    size: attachment.size,
    lastModified: attachment.lastModified
  };

  const classification = classifyAttachmentContent(
    {
      name: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size
    },
    attachment.text
  );

  if (classification === "unsupported_type" || classification === "unsupported_mime") {
    return {
      result: buildAttachmentResult({
        ...base,
        action: "unsupported",
        sanitizedName: sanitizedFallbackName(attachment.originalName),
        reason: `This file type is not governed in browser mode yet. ${sanitizedFallbackName(attachment.originalName)} was not uploaded. Use Accord Workspace for governed file analysis.`,
        riskScore: 0,
        entityCounts: {},
        redactionCount: 0,
        personDetection: unavailablePersonDetection(),
        surface: payload.surface,
        blockedReasonCategory: classification
      })
    };
  }

  if (classification === "too_large") {
    return {
      result: buildAttachmentResult({
        ...base,
        action: "too_large",
        sanitizedName: sanitizedFallbackName(attachment.originalName),
        reason: `${sanitizedFallbackName(attachment.originalName)} is too large for browser-mode governance. It was not uploaded. Use Accord Workspace.`,
        riskScore: 0,
        entityCounts: {},
        redactionCount: 0,
        personDetection: unavailablePersonDetection(),
        surface: payload.surface,
        blockedReasonCategory: "too_large"
      })
    };
  }

  if (classification === "read_failed") {
    return {
      result: buildAttachmentResult({
        ...base,
        action: "failed",
        sanitizedName: sanitizedFallbackName(attachment.originalName),
        reason: `Accord could not read ${sanitizedFallbackName(attachment.originalName)} locally. It was not uploaded.`,
        riskScore: 0,
        entityCounts: {},
        redactionCount: 0,
        personDetection: unavailablePersonDetection(),
        surface: payload.surface,
        blockedReasonCategory: "read_failed"
      })
    };
  }

  if (classification === "binary_content") {
    return {
      result: buildAttachmentResult({
        ...base,
        action: "binary",
        sanitizedName: sanitizedFallbackName(attachment.originalName),
        reason: `${sanitizedFallbackName(attachment.originalName)} appears to contain binary data and was not uploaded.`,
        riskScore: 0,
        entityCounts: {},
        redactionCount: 0,
        personDetection: unavailablePersonDetection(),
        surface: payload.surface,
        blockedReasonCategory: "binary_content"
      })
    };
  }

  const attachmentText = attachment.text;
  if (typeof attachmentText !== "string") {
    return {
      result: buildAttachmentResult({
        ...base,
        action: "failed",
        sanitizedName: sanitizedFallbackName(attachment.originalName),
        reason: `Accord could not read ${sanitizedFallbackName(attachment.originalName)} locally. It was not uploaded.`,
        riskScore: 0,
        entityCounts: {},
        redactionCount: 0,
        personDetection: unavailablePersonDetection(),
        surface: payload.surface,
        blockedReasonCategory: "read_failed"
      })
    };
  }

  const filenameScan = await governAttachmentFilename(attachment.originalName, payload.sensitivity, seedRedactionMap);
  const filenameDecision = decidePolicy(filenameScan.scan);
  const filenameSeed = {
    ...seedRedactionMap,
    ...filenameScan.scan.redactionMap
  };
  const contentScanResult = await runGovernanceScan(attachmentText, "attachment", payload.sensitivity || "Internal", filenameSeed);
  const contentScan = applyConversationStableRedactions(attachmentText, contentScanResult.scan, filenameSeed);
  const contentDecision = decidePolicy(contentScan);
  const combinedEntities = [...filenameScan.scan.entities, ...contentScan.entities];
  const entityCounts = countEntities(combinedEntities);
  const redactionCount = new Set(combinedEntities.map((entity) => entity.id)).size;
  const combinedRisk = Math.max(filenameScan.scan.riskScore, contentScan.riskScore);
  const personDetection = mergePersonDetection(filenameScan.personDetection, contentScanResult.personDetection);

  if (filenameDecision.action === "block" || contentDecision.action === "block") {
    return {
      result: buildAttachmentResult({
        ...base,
        action: "blocked",
        sanitizedName: filenameScan.sanitizedName,
        reason: hasSecret(contentScan) || hasSecret(filenameScan.scan)
          ? `Possible credential detected. ${filenameScan.sanitizedName} was not uploaded.`
          : `Unsafe file content detected. ${filenameScan.sanitizedName} was not uploaded.`,
        riskScore: combinedRisk,
        entityCounts,
        redactionCount,
        personDetection,
        surface: payload.surface,
        blockedReasonCategory: hasSecret(contentScan) || hasSecret(filenameScan.scan) ? "secret" : "policy_block"
      })
    };
  }

  const action: GovernedAttachmentAction = redactionCount > 0 ? "redacted" : "clean";
  const result = buildAttachmentResult({
    ...base,
    action,
    sanitizedName: filenameScan.sanitizedName,
    reason:
      action === "redacted"
        ? `${redactionCount} identifier${redactionCount === 1 ? "" : "s"} protected in ${filenameScan.sanitizedName}. Only the governed copy will be uploaded.`
        : `${filenameScan.sanitizedName} governed locally.`,
    riskScore: combinedRisk,
    entityCounts,
    redactionCount,
    personDetection,
    surface: payload.surface,
    sanitizedText: contentScan.redactedText
  });

  return {
    result,
    redactionMap: {
      ...filenameScan.scan.redactionMap,
      ...contentScan.redactionMap
    }
  };
}

async function governAttachmentFilename(originalName: string, sensitivity: string, seedRedactionMap: RedactionMap) {
  const { stem, extension } = splitFileName(originalName);
  const normalizedStem = stem.replace(/[._-]+/g, " ");
  const variants = Array.from(new Set([stem, normalizedStem].filter(Boolean)));
  const scans = await Promise.all(variants.map((variant) => runGovernanceScan(variant, "attachment", sensitivity || "Internal", seedRedactionMap)));
  const best = scans
    .map(({ scan, personDetection }, index) => ({
      scan: applyConversationStableRedactions(variants[index], scan, seedRedactionMap),
      personDetection,
      source: variants[index]
    }))
    .sort((a, b) => b.scan.entities.length - a.scan.entities.length || b.scan.riskScore - a.scan.riskScore)[0];
  const safeStem = best?.scan.entities.length ? slugifyGovernedStem(best.scan.redactedText) : sanitizePlainStem(stem);

  return {
    scan: best?.scan || scanText(stem, "attachment", sensitivity || "Internal", { seedRedactionMap }),
    personDetection: best?.personDetection || unavailablePersonDetection(),
    sanitizedName: `${safeStem || "attachment"}${extension}`
  };
}

type AttachmentResultInput = Omit<GovernedAttachmentResult, "originalNameCategory" | "telemetry"> & {
  surface: GovernAttachmentsPayload["surface"];
  blockedReasonCategory?: string;
};

function buildAttachmentResult(input: AttachmentResultInput): GovernedAttachmentResult {
  const { surface, blockedReasonCategory, ...result } = input;

  return {
    ...result,
    originalNameCategory: "raw_not_returned",
    telemetry: {
      surface,
      attachmentCount: 1,
      sanitizedName: input.sanitizedName,
      extension: input.extension,
      mimeCategory: mimeCategory(input.mimeType),
      sizeBucket: sizeBucket(input.size),
      action: input.action,
      riskScore: input.riskScore,
      entityCounts: input.entityCounts,
      redactionCount: input.redactionCount,
      blockedReasonCategory,
      personDetectorStatus: input.personDetection.nerStatus,
      timestamp: new Date().toISOString()
    }
  };
}

function firstBlockingSummary(results: GovernedAttachmentResult[]) {
  const blocked = results.find((result) => !["clean", "redacted"].includes(result.action));
  if (!blocked) return "Attachment upload blocked by Accord.";

  if (results.length > 1) {
    const fileWord = `${results.length}-file upload blocked.`;
    const neither = "Neither file was uploaded.";
    if (blocked.action === "blocked" && blocked.telemetry.blockedReasonCategory === "secret") {
      return `${fileWord} ${blocked.sanitizedName} contains a possible credential. ${neither}`;
    }
    return `${fileWord} ${blocked.reason} ${neither}`;
  }

  return blocked.reason;
}

function buildAttachmentSummary(results: GovernedAttachmentResult[]) {
  if (results.length === 1) return results[0].reason;
  const redactions = results.reduce((sum, result) => sum + result.redactionCount, 0);
  if (redactions > 0) return `${redactions} identifier${redactions === 1 ? "" : "s"} protected across ${results.length} file${results.length === 1 ? "" : "s"}.`;
  return `${results.length} file${results.length === 1 ? "" : "s"} governed locally.`;
}

function hasSecret(scan: ChatScanResult) {
  return scan.entities.some((entity) => entity.type === "SECRET") || scan.flags.some((flag) => flag.type === "secret");
}

function mergePersonDetection(first: PersonDetectionCoverage, second: PersonDetectionCoverage): PersonDetectionCoverage {
  const statuses: Record<PersonDetectionCoverage["nerStatus"], number> = {
    ready: 0,
    unavailable: 1,
    timeout: 2,
    error: 3
  };
  const status = statuses[first.nerStatus] >= statuses[second.nerStatus] ? first.nerStatus : second.nerStatus;

  return {
    ...second,
    nerStatus: status,
    candidateCount: first.candidateCount + second.candidateCount,
    timedOut: first.timedOut || second.timedOut
  };
}

function unavailablePersonDetection(): PersonDetectionCoverage {
  return {
    mode: "hybrid-local-rules",
    nerStatus: "unavailable",
    detector: "local_person_detector_v1",
    candidateCount: 0,
    timedOut: false,
    model: {
      name: "none",
      assetSizeBytes: 0,
      executionContext: "service_worker"
    }
  };
}

function sanitizedFallbackName(name: string) {
  const { stem, extension } = splitFileName(name);
  return `${sanitizePlainStem(stem) || "attachment"}${extension}`;
}

function slugifyGovernedStem(stem: string) {
  return stem
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}\[\]_.-]+/gu, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function sanitizePlainStem(stem: string) {
  return slugifyGovernedStem(stem).replace(/\[(PERSON|EMAIL|PHONE|ADDRESS|ACCOUNT|SECRET|OTHER)_\d+\]/g, "redacted");
}

function sizeBucket(size: number) {
  if (size <= 10 * 1024) return "0-10kb";
  if (size <= 100 * 1024) return "10-100kb";
  if (size <= MAX_GUARDED_TEXT_ATTACHMENT_BYTES) return "100-256kb";
  return "over_limit";
}

async function runGovernanceScan(text: string, stage: ChatScanResult["stage"], sensitivity: string, seedRedactionMap: RedactionMap) {
  const personDetection = await detectPersonCandidates(text);
  const scan = scanText(text, stage, sensitivity, {
    seedRedactionMap,
    additionalCandidates: personDetection.candidates
  });

  return {
    scan,
    personDetection: personDetection.coverage
  };
}

function toSafeScanResult(
  scan: ChatScanResult,
  decision: ChatPolicyDecision,
  includeSanitizedText: boolean,
  personDetection: PersonDetectionCoverage
): SafeScanResult {
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
    personDetection,
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

    for (const range of findLiteralRanges(text, entity.originalText, entity.type)) {
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

function findLiteralRanges(text: string, literal: string, type: EntityType) {
  const ranges: Array<{ start: number; end: number }> = [];
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, type === "PERSON" ? "gi" : "g");

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
