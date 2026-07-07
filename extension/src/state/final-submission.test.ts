import { describe, expect, test, vi } from "vitest";
import { runFinalSubmissionDecision, TrustedSubmissionGate } from "./final-submission";
import type { SafeScanResult } from "../messaging/types";

describe("final submission controller", () => {
  test("fails closed when sanitized composer verification fails", async () => {
    const submitTrusted = vi.fn();
    const states: unknown[] = [];

    const outcome = await runFinalSubmissionDecision({
      readDraft: () => "Draft an email to John Smith.",
      scan: async () => scanResult({ action: "redact", sanitizedText: "Draft an email to [PERSON_1]." }),
      setDraftText: vi.fn(),
      verifyDraftText: () => "Draft an email to John Smith.",
      submitTrusted,
      onState: (state) => states.push(state)
    });

    expect(outcome).toBe("failed");
    expect(submitTrusted).not.toHaveBeenCalled();
    expect(states).toContainEqual(
      expect.objectContaining({
        phase: "failed",
        message: "Accord could not verify the sanitized draft. Message not sent."
      })
    );
  });

  test("submits trusted sanitized text exactly once", async () => {
    const submitTrusted = vi.fn();

    const outcome = await runFinalSubmissionDecision({
      readDraft: () => "Draft an email to John Smith.",
      scan: async () => scanResult({ action: "redact", sanitizedText: "Draft an email to [PERSON_1]." }),
      setDraftText: vi.fn(),
      verifyDraftText: () => "Draft an email to [PERSON_1].",
      submitTrusted,
      onState: vi.fn()
    });

    expect(outcome).toBe("submitted");
    expect(submitTrusted).toHaveBeenCalledTimes(1);
  });

  test("trusted submission gate prevents recursive raw interception loops", () => {
    const gate = new TrustedSubmissionGate();

    expect(gate.consumeIfAuthorized()).toBe(false);
    gate.authorizeNext();
    expect(gate.consumeIfAuthorized()).toBe(true);
    expect(gate.consumeIfAuthorized()).toBe(false);
  });
});

function scanResult(overrides: Partial<SafeScanResult>): SafeScanResult {
  return {
    scanId: "scan_test",
    action: "allow",
    riskScore: 10,
    riskLevel: "low",
    detectedEntityCount: 0,
    entityCounts: {},
    decorations: [],
    flags: [],
    explanation: "No elevated issue.",
    ...overrides
  };
}
