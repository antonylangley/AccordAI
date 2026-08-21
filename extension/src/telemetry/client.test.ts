import { describe, expect, test } from "vitest";
import { sanitizeGuardTelemetryPayload } from "./client";

describe("telemetry privacy boundary", () => {
  test("retains policy metadata and drops raw-content-shaped fields", () => {
    const payload = sanitizeGuardTelemetryPayload({
      eventType: "message_blocked",
      surface: "chatgpt",
      conversationKey: "conversation-hash",
      ruleId: "accord.confidential.unpublished-financials",
      policyAction: "HOLD",
      detectedCategories: ["unpublished_financials"],
      metadata: {
        enforcementSource: "accord_builtin",
        prompt: "synthetic raw prompt must not leave browser",
        originalText: "synthetic detected value"
      }
    });

    expect(payload.ruleId).toBe("accord.confidential.unpublished-financials");
    expect(payload.metadata).toEqual({ enforcementSource: "accord_builtin" });
    expect(JSON.stringify(payload)).not.toContain("synthetic raw prompt");
    expect(JSON.stringify(payload)).not.toContain("synthetic detected value");
  });

  test("does not copy unknown top-level raw fields", () => {
    const unsafe = {
      eventType: "message_sent_to_ai",
      surface: "chatgpt",
      conversationKey: "conversation-hash",
      rawPrompt: "synthetic raw prompt"
    } as Parameters<typeof sanitizeGuardTelemetryPayload>[0];

    expect(sanitizeGuardTelemetryPayload(unsafe)).not.toHaveProperty("rawPrompt");
  });
});
