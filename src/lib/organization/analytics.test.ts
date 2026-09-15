import { describe, expect, test } from "vitest";
import {
  classifyOrganizationEvent,
  isRiskEvent,
  isSummaryEvent,
  organizationRangeStart
} from "./analytics";

describe("organization analytics", () => {
  test("classifies enforcement outcomes without reading prompt content", () => {
    expect(classifyOrganizationEvent({ event_type: "message_blocked", action: "allow" })).toBe("blocked");
    expect(classifyOrganizationEvent({ event_type: "message_sent_to_ai", action: "redact" })).toBe("redacted");
    expect(classifyOrganizationEvent({ event_type: "message_sent_to_ai", policy_action: "require_approval" })).toBe("held");
    expect(classifyOrganizationEvent({ event_type: "extension_error", action: "failed" })).toBe("error");
    expect(isSummaryEvent({ event_type: "assistant_response_rehydrated" })).toBe(false);
  });

  test("keeps employee ranges bounded and separates risk from allowed activity", () => {
    expect(organizationRangeStart("7d", new Date("2026-09-14T18:00:00.000Z")).toISOString()).toBe("2026-09-08T00:00:00.000Z");
    expect(isRiskEvent({ event_type: "message_blocked", action: "block" })).toBe(true);
    expect(isRiskEvent({ event_type: "message_sent_to_ai", action: "allow" })).toBe(false);
  });
});
