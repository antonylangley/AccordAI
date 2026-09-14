import { riskLevelForScore } from "@/lib/organization/member-risk";
import type {
  OrganizationBreakdownItem,
  OrganizationDateRange,
  OrganizationEventCategory,
  OrganizationTrendPoint
} from "@/lib/organization/types";

export type RawOrganizationEvent = {
  id?: unknown;
  auth_user_id?: unknown;
  extension_user_id?: unknown;
  created_at?: unknown;
  event_type?: unknown;
  surface?: unknown;
  action?: unknown;
  risk_score?: unknown;
  risk_level?: unknown;
  flags?: unknown;
  entity_counts?: unknown;
  redaction_count?: unknown;
  attachment_count?: unknown;
  message_length_bucket?: unknown;
  metadata?: unknown;
  rule_key?: unknown;
  policy_action?: unknown;
  policy_severity?: unknown;
  ai_provider?: unknown;
  destination_type?: unknown;
  detected_categories?: unknown;
};

export const ORGANIZATION_RANGE_DAYS: Record<OrganizationDateRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90
};

export function parseOrganizationRange(value?: string): OrganizationDateRange {
  return value === "7d" || value === "90d" ? value : "30d";
}

export function organizationRangeStart(range: OrganizationDateRange, now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - ORGANIZATION_RANGE_DAYS[range] + 1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function classifyOrganizationEvent(event: RawOrganizationEvent): OrganizationEventCategory {
  const type = stringValue(event.event_type).toLowerCase();
  const action = stringValue(event.action).toLowerCase();
  const policyAction = stringValue(event.policy_action).toLowerCase();
  const redactions = numberValue(event.redaction_count);

  if (type.includes("blocked") || action === "block" || action === "blocked") return "blocked";
  if (action === "redact" || action === "redacted" || redactions > 0) return "redacted";
  if (policyAction === "hold" || policyAction === "require_approval" || action === "hold") return "held";
  if (action === "warn" || action === "warning") return "warning";
  if (type.includes("error") || action === "failed") return "error";
  if (action === "allow" || action === "allowed" || action === "clean") return "allowed";
  return "flagged";
}

export function isSummaryEvent(event: RawOrganizationEvent) {
  const type = stringValue(event.event_type).toLowerCase();
  if (!type || type === "assistant_response_rehydrated") return false;
  if (type.includes("error") && classifyOrganizationEvent(event) === "error") return false;
  return true;
}

export function isRiskEvent(event: RawOrganizationEvent) {
  const category = classifyOrganizationEvent(event);
  return category !== "allowed" && category !== "error";
}

export function buildOrganizationTrend(
  events: RawOrganizationEvent[],
  range: OrganizationDateRange,
  now = new Date()
): OrganizationTrendPoint[] {
  const start = organizationRangeStart(range, now);
  const days = ORGANIZATION_RANGE_DAYS[range];
  const points = Array.from({ length: days }, (_, offset) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      }).format(date),
      allowed: 0,
      enforced: 0,
      total: 0
    };
  });
  const byDate = new Map(points.map((point) => [point.date, point]));

  for (const event of events) {
    if (!isSummaryEvent(event)) continue;
    const createdAt = stringValue(event.created_at);
    const point = byDate.get(createdAt.slice(0, 10));
    if (!point) continue;
    point.total += 1;
    if (isRiskEvent(event)) point.enforced += 1;
    else point.allowed += 1;
  }

  return points;
}

export function buildOrganizationBreakdown(events: RawOrganizationEvent[]): OrganizationBreakdownItem[] {
  const order: OrganizationEventCategory[] = ["blocked", "redacted", "held", "warning", "flagged", "allowed", "error"];
  const labels: Record<OrganizationEventCategory, string> = {
    blocked: "Blocked",
    redacted: "Redacted",
    held: "Held for review",
    warning: "Warnings",
    flagged: "Other flagged",
    allowed: "Allowed",
    error: "Runtime errors"
  };
  const counts = new Map<OrganizationEventCategory, number>();
  for (const event of events) {
    if (stringValue(event.event_type) === "assistant_response_rehydrated") continue;
    const category = classifyOrganizationEvent(event);
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  return order
    .map((category) => ({ category, label: labels[category], count: counts.get(category) || 0 }))
    .filter((item) => item.count > 0);
}

export function riskEventTrendPercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : undefined;
  return Math.round(((current - previous) / previous) * 100);
}

export function safeMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function safeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
}

export function eventRiskScore(event: RawOrganizationEvent) {
  return Math.max(0, Math.min(100, numberValue(event.risk_score)));
}

export function eventRiskLevel(event: RawOrganizationEvent) {
  return riskLevelForScore(eventRiskScore(event));
}

export function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
