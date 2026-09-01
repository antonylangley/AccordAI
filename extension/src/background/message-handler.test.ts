import { describe, expect, test, vi } from "vitest";
import { createAccordGuardMessageHandler } from "./message-handler";
import type { GuardEnforcementState } from "../auth/types";
import type { SafeScanResult, ScanDraftPayload } from "../messaging/types";

describe("Accord Guard background message handler", () => {
  test("skips the enforcement pipeline while an owner pause is active", async () => {
    const scanDraft = vi.fn(async () => scanResult({ action: "block" }));
    const handler = createAccordGuardMessageHandler({
      scanDraft,
      getGuardEnforcementState: vi.fn(async () => enforcementState(false))
    });

    const response = await handler({ type: "accord.scanDraft", payload: scanPayload() });

    expect(scanDraft).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      result: {
        action: "allow",
        detectedEntityCount: 0,
        decorations: [],
        flags: []
      }
    });
  });

  test("runs normal enforcement after Guard is active again", async () => {
    const scanDraft = vi.fn(async () => scanResult({ action: "block" }));
    const handler = createAccordGuardMessageHandler({
      scanDraft,
      getGuardEnforcementState: vi.fn(async () => enforcementState(true))
    });
    const payload = scanPayload();

    const response = await handler({ type: "accord.scanDraft", payload });

    expect(scanDraft).toHaveBeenCalledWith(payload);
    expect(response).toMatchObject({
      ok: true,
      result: {
        action: "block"
      }
    });
  });
});

function enforcementState(enabled: boolean): GuardEnforcementState {
  return {
    enabled,
    paused: !enabled,
    canPause: true,
    reason: enabled ? "active" : "owner_paused",
    updatedAt: "2026-08-31T00:00:00.000Z",
    scope: { userId: "owner_1", organizationId: "org_1", role: "owner" }
  };
}

function scanPayload(): ScanDraftPayload {
  return {
    surface: "chatgpt",
    conversationKey: "conversation:test",
    text: "Confidential board material.",
    sensitivity: "Internal",
    authoritative: true,
    includeSanitizedText: true
  };
}

function scanResult(overrides: Partial<SafeScanResult>): SafeScanResult {
  return {
    scanId: "scan_test",
    action: "allow",
    riskScore: 0,
    riskLevel: "low",
    detectedEntityCount: 0,
    entityCounts: {},
    decorations: [],
    flags: [],
    explanation: "No elevated issue.",
    enforcementSource: "accord_core",
    personDetection: {
      mode: "local-ner",
      nerStatus: "ready",
      detector: "test",
      candidateCount: 0,
      timedOut: false,
      model: {
        name: "none",
        assetSizeBytes: 0,
        executionContext: "service_worker"
      }
    },
    ...overrides
  };
}
