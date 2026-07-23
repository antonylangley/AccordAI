import type {
  ChatFlagSeverity,
  ChatFlagType,
  ChatPolicyAction,
  ChatScanStage,
  EntityCountSummary,
  EntityType
} from "@accord/governance-core";
import type { AISurface } from "../adapters/types";
import type { AttachmentExtractionKind } from "../attachments/policy";
import type { PersonDetectionCoverage } from "../person-detection/person-detector";

export type SafeRiskFlag = {
  type: ChatFlagType;
  label: string;
  severity: ChatFlagSeverity;
  stage: ChatScanStage;
  evidence: string;
};

export type EntityDecoration = {
  type: EntityType;
  start: number;
  end: number;
  placeholder: string;
};

export type SafeScanResult = {
  scanId: string;
  action: ChatPolicyAction;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  detectedEntityCount: number;
  entityCounts: EntityCountSummary;
  decorations: EntityDecoration[];
  flags: SafeRiskFlag[];
  explanation: string;
  personDetection: PersonDetectionCoverage;
  sanitizedText?: string;
};

export type ScanDraftPayload = {
  surface: AISurface;
  conversationKey: string;
  text: string;
  sensitivity: string;
  authoritative: boolean;
  includeSanitizedText: boolean;
};

export type RehydrateResponsePayload = {
  surface: AISurface;
  conversationKey: string;
  text: string;
};

export type MoveVaultPayload = {
  surface: AISurface;
  fromConversationKey: string;
  toConversationKey: string;
};

export type GuardAttachmentInput = {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  lastModified: number;
  text?: string;
  extractionKind?: AttachmentExtractionKind;
  extractionReason?: string;
  extractionWarnings?: string[];
  extractedCharacterCount?: number;
};

export type GovernAttachmentsPayload = {
  surface: AISurface;
  conversationKey: string;
  sensitivity: string;
  attachments: GuardAttachmentInput[];
};

export type GovernedAttachmentAction = "clean" | "redacted" | "blocked" | "unsupported" | "too_large" | "failed" | "binary";

export type SafeAttachmentTelemetry = {
  surface: AISurface;
  attachmentCount: number;
  sanitizedName: string;
  extension: string;
  mimeCategory: string;
  sizeBucket: string;
  action: GovernedAttachmentAction;
  riskScore: number;
  entityCounts: EntityCountSummary;
  redactionCount: number;
  blockedReasonCategory?: string;
  extractionKind?: AttachmentExtractionKind;
  extractionWarnings?: string[];
  extractedCharacterCount?: number;
  personDetectorStatus: PersonDetectionCoverage["nerStatus"];
  timestamp: string;
};

export type GovernedAttachmentResult = {
  id: string;
  action: GovernedAttachmentAction;
  originalNameCategory: "raw_not_returned";
  sanitizedName: string;
  extension: string;
  mimeType: string;
  size: number;
  lastModified: number;
  riskScore: number;
  entityCounts: EntityCountSummary;
  redactionCount: number;
  reason: string;
  personDetection: PersonDetectionCoverage;
  extractionKind?: AttachmentExtractionKind;
  extractionWarnings?: string[];
  extractedCharacterCount?: number;
  sanitizedText?: string;
  telemetry: SafeAttachmentTelemetry;
};

export type GovernAttachmentsResult = {
  batchAction: "allow" | "block";
  results: GovernedAttachmentResult[];
  summary: string;
};

export type RehydrateSafeResult = {
  resolvedText: string;
  replacements: Array<{
    placeholder: string;
    type: EntityType;
    start: number;
    end: number;
  }>;
  resolvedCount: number;
  unresolvedPlaceholders: string[];
  text: string;
  replacedCount: number;
  unresolvedPlaceholderCount: number;
};

export type AccordGuardMessage =
  | { type: "accord.scanDraft"; payload: ScanDraftPayload }
  | { type: "accord.governAttachments"; payload: GovernAttachmentsPayload }
  | { type: "accord.rehydrateResponse"; payload: RehydrateResponsePayload }
  | { type: "accord.moveVault"; payload: MoveVaultPayload };

export type AccordGuardResponse =
  | { ok: true; result?: SafeScanResult | RehydrateSafeResult | GovernAttachmentsResult }
  | { ok: false; error: string };
