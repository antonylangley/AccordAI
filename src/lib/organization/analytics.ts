import { riskLevelForScore } from "@/lib/organization/member-risk";
import type { OrganizationDateRange, OrganizationEventCategory } from "@/lib/organization/types";

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

const ORGANIZATION_RANGE_DAYS: Record<OrganizationDateRange, number> = {
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
