import { describe, expect, test } from "vitest";
import {
  buildOrganizationBreakdown,
  buildOrganizationTrend,
  classifyOrganizationEvent,
  isSummaryEvent,
  riskEventTrendPercent
} from "./analytics";

describe("organization analytics", () => {
  test("classifies enforcement outcomes without reading prompt content", () => {
    expect(classifyOrganizationEvent({ event_type: "message_blocked", action: "allow" })).toBe("blocked");
    expect(classifyOrganizationEvent({ event_type: "message_sent_to_ai", action: "redact" })).toBe("redacted");
    expect(classifyOrganizationEvent({ event_type: "message_sent_to_ai", policy_action: "require_approval" })).toBe("held");
    expect(classifyOrganizationEvent({ event_type: "extension_error", action: "failed" })).toBe("error");
    expect(isSummaryEvent({ event_type: "assistant_response_rehydrated" })).toBe(false);
  });

  test("builds a bounded trend and enforcement breakdown", () => {
    const events = [
      { created_at: "2026-09-14T12:00:00.000Z", event_type: "message_sent_to_ai", action: "allow" },
      { created_at: "2026-09-14T13:00:00.000Z", event_type: "message_blocked", action: "block" },
      { created_at: "2026-09-13T13:00:00.000Z", event_type: "message_sent_to_ai", action: "redact" }
    ];
    const trend = buildOrganizationTrend(events, "7d", new Date("2026-09-14T18:00:00.000Z"));
    expect(trend).toHaveLength(7);
    expect(trend.at(-1)).toMatchObject({ allowed: 1, enforced: 1, total: 2 });
    expect(buildOrganizationBreakdown(events)).toEqual([
      { category: "blocked", label: "Blocked", count: 1 },
      { category: "redacted", label: "Redacted", count: 1 },
      { category: "allowed", label: "Allowed", count: 1 }
    ]);
    expect(riskEventTrendPercent(12, 10)).toBe(20);
    expect(riskEventTrendPercent(2, 0)).toBeUndefined();
  });
});
