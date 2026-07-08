import type {
  ChatFlagSeverity,
  ChatFlagType,
  ChatPolicyAction,
  ChatScanStage,
  EntityCountSummary,
  EntityType
} from "@accord/governance-core";
import type { AISurface } from "../adapters/types";

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
  | { type: "accord.rehydrateResponse"; payload: RehydrateResponsePayload }
  | { type: "accord.moveVault"; payload: MoveVaultPayload };

export type AccordGuardResponse =
  | { ok: true; result?: SafeScanResult | RehydrateSafeResult }
  | { ok: false; error: string };
