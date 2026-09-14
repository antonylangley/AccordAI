import "server-only";

import type { User } from "@supabase/supabase-js";
import { getOrganizationMembers } from "@/lib/auth/organization";
import { getAccordAuthProfile } from "@/lib/auth/user-profile";
import { getSupabaseServerClient } from "@/lib/db/accord-store";
import {
  buildOrganizationBreakdown,
  buildOrganizationTrend,
  classifyOrganizationEvent,
  eventRiskLevel,
  eventRiskScore,
  isRiskEvent,
  isSummaryEvent,
  numberValue,
  ORGANIZATION_RANGE_DAYS,
  organizationRangeStart,
  riskEventTrendPercent,
  safeMetadata,
  safeStringArray,
  stringValue,
  type RawOrganizationEvent
} from "@/lib/organization/analytics";
import { riskLevelForScore } from "@/lib/organization/member-risk";
import type {
  OrganizationAuditEvent,
  OrganizationDateRange,
  OrganizationOverview,
  OrganizationPersonDetail,
  OrganizationPersonSummary
} from "@/lib/organization/types";

const OVERVIEW_EVENT_LIMIT = 1500;
const DETAIL_EVENT_LIMIT = 100;
const overviewEventColumns = "id,auth_user_id,extension_user_id,created_at,event_type,surface,action,risk_score,risk_level,flags,entity_counts,redaction_count,attachment_count,message_length_bucket,rule_key,policy_action,policy_severity,ai_provider,destination_type,detected_categories";
const detailEventColumns = `${overviewEventColumns},metadata`;

type ExtensionUserRow = {
  id: string;
  auth_user_id?: string | null;
  department?: string | null;
  surface?: string | null;
  last_seen_at?: string | null;
};

type PolicyLookup = Map<string, {
  name: string;
  source?: string;
  action?: string;
  severity?: string;
  controlType?: string;
  enforceability?: string;
  condition?: string;
  reasoning?: string;
  confidence?: number;
}>;

export async function getOrganizationOverview(
  companySlug: string,
  currentUserId: string | undefined,
  range: OrganizationDateRange
): Promise<OrganizationOverview | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !currentUserId || !(await isOrganizationAdmin(companySlug, currentUserId))) return null;

  const now = new Date();
  const currentStart = organizationRangeStart(range, now);
  const queryStart = new Date(currentStart);
  queryStart.setUTCDate(queryStart.getUTCDate() - ORGANIZATION_RANGE_DAYS[range]);

  const members = await getOrganizationMembers(companySlug, currentUserId);
  const [extensionResult, eventResult, authResult, policyLookup] = await Promise.all([
    supabase
      .from("accord_extension_users")
      .select("id,auth_user_id,department,surface,last_seen_at")
      .eq("company_slug", companySlug),
    supabase
      .from("accord_extension_events")
      .select(overviewEventColumns)
      .eq("company_slug", companySlug)
      .gte("created_at", queryStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(OVERVIEW_EVENT_LIMIT + 1),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    getPolicyLookup(companySlug)
  ]);

  if (extensionResult.error || eventResult.error || authResult.error) return null;

  const allEvents = (eventResult.data || []) as RawOrganizationEvent[];
  const isTruncated = allEvents.length > OVERVIEW_EVENT_LIMIT;
  const boundedEvents = allEvents.slice(0, OVERVIEW_EVENT_LIMIT);
  const currentEvents = boundedEvents.filter((event) => Date.parse(stringValue(event.created_at)) >= currentStart.getTime());
  const previousEvents = boundedEvents.filter((event) => {
    const timestamp = Date.parse(stringValue(event.created_at));
    return timestamp >= queryStart.getTime() && timestamp < currentStart.getTime();
  });
  const extensions = normalizeExtensionRows(extensionResult.data || []);
  const authUsers = new Map((authResult.data?.users || []).map((user) => [user.id, user]));
  const people = buildPeople({
    members,
    authUsers,
    extensionRows: extensions,
    events: currentEvents,
    rangeStart: currentStart,
    policyLookup
  });
  const activeMembers = people.filter((person) => person.status === "active");
  const reportingMembers = activeMembers.filter((person) => person.coverageStatus === "reporting").length;
  const summaryEvents = currentEvents.filter(isSummaryEvent);
  const riskEvents = summaryEvents.filter(isRiskEvent).length;
  const previousRiskEvents = previousEvents.filter(isSummaryEvent).filter(isRiskEvent).length;
  const enforced = summaryEvents.filter((event) => {
    const category = classifyOrganizationEvent(event);
    return category === "blocked" || category === "redacted" || category === "held" || category === "warning";
  }).length;
  const blockedEvents = summaryEvents.filter((event) => classifyOrganizationEvent(event) === "blocked").length;
  const redactedEvents = summaryEvents.filter((event) => classifyOrganizationEvent(event) === "redacted").length;

  return {
    range,
    rangeStart: currentStart.toISOString(),
    generatedAt: now.toISOString(),
    people,
    metrics: {
      activeMembers: activeMembers.length,
      reportingMembers,
      riskEvents,
      riskEventTrendPercent: riskEventTrendPercent(riskEvents, previousRiskEvents),
      highRiskUsers: people.filter((person) => person.auditCount > 0 && (person.riskLevel === "high" || person.riskLevel === "critical")).length,
      enforcementRate: percentage(enforced, summaryEvents.length),
      blockedEvents,
      redactedEvents,
      coverageRate: percentage(reportingMembers, activeMembers.length),
      totalEvents: summaryEvents.length
    },
    trend: buildOrganizationTrend(currentEvents, range, now),
    breakdown: buildOrganizationBreakdown(currentEvents),
    surfaces: surfaceBreakdown(currentEvents),
    isTruncated
  };
}

export async function getOrganizationPersonDetail(
  companySlug: string,
  currentUserId: string | undefined,
  memberId: string,
  range: OrganizationDateRange,
  before?: string
): Promise<OrganizationPersonDetail | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !currentUserId || !(await isOrganizationAdmin(companySlug, currentUserId))) return null;

  const overview = await getOrganizationOverview(companySlug, currentUserId, range);
  const person = overview?.people.find((candidate) => candidate.id === memberId);
  if (!person) return null;
  if (!person.userId) return { person, events: [], policies: [], hasMore: false };

  const { data: extensionRows } = await supabase
    .from("accord_extension_users")
    .select("id")
    .eq("company_slug", companySlug)
    .eq("auth_user_id", person.userId);
  const extensionIds = (extensionRows || []).flatMap((row) => typeof row.id === "string" ? [row.id] : []);
  const start = organizationRangeStart(range);
  const directQuery = applyDetailBounds(
    supabase.from("accord_extension_events").select(detailEventColumns).eq("company_slug", companySlug).eq("auth_user_id", person.userId),
    start,
    before
  );
  const extensionQuery = extensionIds.length
    ? applyDetailBounds(
        supabase.from("accord_extension_events").select(detailEventColumns).eq("company_slug", companySlug).in("extension_user_id", extensionIds),
        start,
        before
      )
    : null;
  const [directResult, extensionResult, policyLookup] = await Promise.all([
    directQuery.order("created_at", { ascending: false }).limit(DETAIL_EVENT_LIMIT + 1),
    extensionQuery ? extensionQuery.order("created_at", { ascending: false }).limit(DETAIL_EVENT_LIMIT + 1) : Promise.resolve({ data: [], error: null }),
    getPolicyLookup(companySlug)
  ]);
  const deduped = new Map<string, RawOrganizationEvent>();
  for (const event of [...(directResult.data || []), ...(extensionResult.data || [])] as RawOrganizationEvent[]) {
    const id = stringValue(event.id);
    if (id) deduped.set(id, event);
  }
  const rawEvents = Array.from(deduped.values()).sort(
    (a, b) => Date.parse(stringValue(b.created_at)) - Date.parse(stringValue(a.created_at))
  );
  const hasMore = rawEvents.length > DETAIL_EVENT_LIMIT;
  const events = rawEvents.slice(0, DETAIL_EVENT_LIMIT).map((event) => toAuditEvent(event, policyLookup));

  return {
    person,
    events,
    policies: buildPolicyActivity(events, policyLookup),
    hasMore
  };
}

async function isOrganizationAdmin(companySlug: string, currentUserId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("accord_company_members")
    .select("id")
    .eq("company_slug", companySlug)
    .eq("user_id", currentUserId)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
    .maybeSingle();
  return Boolean(data);
}

function buildPeople({
  members,
  authUsers,
  extensionRows,
  events,
  rangeStart,
  policyLookup
}: {
  members: Awaited<ReturnType<typeof getOrganizationMembers>>;
  authUsers: Map<string, User>;
  extensionRows: ExtensionUserRow[];
  events: RawOrganizationEvent[];
  rangeStart: Date;
  policyLookup: PolicyLookup;
}) {
  const extensionsByUser = new Map<string, ExtensionUserRow[]>();
  const extensionOwner = new Map<string, string>();
  for (const extension of extensionRows) {
    if (!extension.auth_user_id) continue;
    extensionOwner.set(extension.id, extension.auth_user_id);
    const current = extensionsByUser.get(extension.auth_user_id) || [];
    current.push(extension);
    extensionsByUser.set(extension.auth_user_id, current);
  }
  const eventsByUser = new Map<string, RawOrganizationEvent[]>();
  for (const event of events) {
    const userId = stringValue(event.auth_user_id) || extensionOwner.get(stringValue(event.extension_user_id));
    if (!userId) continue;
    const current = eventsByUser.get(userId) || [];
    current.push(event);
    eventsByUser.set(userId, current);
  }

  return members.map((member): OrganizationPersonSummary => {
    const authUser = member.userId ? authUsers.get(member.userId) : undefined;
    const profile = authUser ? getAccordAuthProfile(authUser) : undefined;
    const extensions = member.userId ? extensionsByUser.get(member.userId) || [] : [];
    const memberEvents = (member.userId ? eventsByUser.get(member.userId) || [] : []).filter(isSummaryEvent);
    const sortedEvents = [...memberEvents].sort((a, b) => Date.parse(stringValue(b.created_at)) - Date.parse(stringValue(a.created_at)));
    const scores = sortedEvents.map(eventRiskScore);
    const averageRiskScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
    const latestExtension = [...extensions].sort((a, b) => Date.parse(b.last_seen_at || "") - Date.parse(a.last_seen_at || ""))[0];
    const lastAuditAt = stringValue(sortedEvents[0]?.created_at) || undefined;
    const riskEvents = sortedEvents.filter(isRiskEvent);
    const enforcementCount = riskEvents.filter((event) => ["blocked", "redacted", "held", "warning"].includes(classifyOrganizationEvent(event))).length;
    const policyCounts = new Map<string, number>();
    for (const event of riskEvents) {
      const key = stringValue(event.rule_key);
      if (key && key !== "none") policyCounts.set(key, (policyCounts.get(key) || 0) + 1);
    }
    const topPolicyKey = Array.from(policyCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topPolicy = topPolicyKey ? policyLookup.get(topPolicyKey) : undefined;

    return {
      ...member,
      displayName: profile?.displayName || displayNameFromEmail(member.email),
      avatarUrl: profile?.avatarUrl,
      department: latestExtension?.department || undefined,
      surfaces: Array.from(new Set([latestExtension?.surface, ...extensions.map((extension) => extension.surface)].filter((surface): surface is string => Boolean(surface)))),
      coverageStatus: coverageStatus(member.status, extensions, sortedEvents, rangeStart),
      averageRiskScore,
      highestRiskScore: scores.length ? Math.max(...scores) : 0,
      latestRiskScore: scores[0] || 0,
      lastAuditAt,
      lastSeenAt: latestExtension?.last_seen_at || undefined,
      auditCount: sortedEvents.length,
      riskEventCount: riskEvents.length,
      enforcementCount,
      enforcementRate: percentage(enforcementCount, sortedEvents.length),
      topPolicyLabel: topPolicy?.name || (topPolicyKey ? labelize(topPolicyKey) : undefined),
      riskLevel: riskLevelForScore(averageRiskScore)
    };
  }).sort((a, b) => {
    if (!a.auditCount && b.auditCount) return 1;
    if (a.auditCount && !b.auditCount) return -1;
    return b.averageRiskScore - a.averageRiskScore || b.riskEventCount - a.riskEventCount || Date.parse(b.lastAuditAt || "") - Date.parse(a.lastAuditAt || "");
  });
}

function coverageStatus(
  memberStatus: string,
  extensions: ExtensionUserRow[],
  events: RawOrganizationEvent[],
  rangeStart: Date
): OrganizationPersonSummary["coverageStatus"] {
  if (memberStatus === "invited") return "invite_pending";
  if (memberStatus === "suspended") return "suspended";
  if (!extensions.length) return "not_reporting";
  const latest = Math.max(
    ...extensions.map((extension) => Date.parse(extension.last_seen_at || "")),
    ...events.map((event) => Date.parse(stringValue(event.created_at)))
  );
  return Number.isFinite(latest) && latest >= rangeStart.getTime() ? "reporting" : "no_recent_activity";
}

function toAuditEvent(event: RawOrganizationEvent, policies: PolicyLookup): OrganizationAuditEvent {
  const ruleKey = stringValue(event.rule_key) || undefined;
  const policy = ruleKey ? policies.get(ruleKey) : undefined;
  const metadata = safeMetadata(event.metadata);
  const enforcementSource = stringValue(metadata.enforcementSource).toLowerCase();
  return {
    id: stringValue(event.id),
    createdAt: stringValue(event.created_at),
    category: classifyOrganizationEvent(event),
    eventType: stringValue(event.event_type) || "governance_event",
    action: stringValue(event.action) || "recorded",
    riskScore: eventRiskScore(event),
    riskLevel: eventRiskLevel(event),
    surface: stringValue(event.surface) || "unknown",
    provider: stringValue(event.ai_provider) || undefined,
    destinationType: stringValue(event.destination_type) || undefined,
    policyAction: stringValue(event.policy_action) || policy?.action,
    policySeverity: stringValue(event.policy_severity) || policy?.severity,
    policyRuleKey: ruleKey,
    policyName: policy?.name,
    policySource: policy?.source,
    policyControlType: policy?.controlType,
    policyEnforceability: policy?.enforceability,
    policyCondition: policy?.condition,
    policyReasoning: policy?.reasoning,
    policyConfidence: policy?.confidence,
    performedLocally: enforcementSource === "local" || enforcementSource === "extension",
    redactionCount: numberValue(event.redaction_count),
    attachmentCount: numberValue(event.attachment_count),
    messageLengthBucket: stringValue(event.message_length_bucket) || undefined,
    detectedCategories: safeStringArray(event.detected_categories),
    detectedEntities: entityCounts(event.entity_counts),
    flags: safeStringArray(event.flags)
  };
}

function buildPolicyActivity(events: OrganizationAuditEvent[], lookup: PolicyLookup) {
  const grouped = new Map<string, OrganizationPersonDetail["policies"][number]>();
  for (const event of events) {
    if (!event.policyRuleKey || event.policyRuleKey === "none") continue;
    const policy = lookup.get(event.policyRuleKey);
    const existing = grouped.get(event.policyRuleKey);
    grouped.set(event.policyRuleKey, {
      key: event.policyRuleKey,
      name: policy?.name || event.policyName || labelize(event.policyRuleKey),
      source: policy?.source || event.policySource,
      action: event.policyAction || policy?.action,
      severity: event.policySeverity || policy?.severity,
      eventCount: (existing?.eventCount || 0) + 1,
      blockCount: (existing?.blockCount || 0) + (event.category === "blocked" ? 1 : 0),
      redactionCount: (existing?.redactionCount || 0) + (event.category === "redacted" ? 1 : 0),
      warningCount: (existing?.warningCount || 0) + (["warning", "flagged", "held"].includes(event.category) ? 1 : 0),
      lastTriggeredAt: existing?.lastTriggeredAt || event.createdAt
    });
  }
  return Array.from(grouped.values()).sort((a, b) => b.eventCount - a.eventCount);
}

async function getPolicyLookup(companySlug: string): Promise<PolicyLookup> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return new Map();
  const { data } = await supabase
    .from("accord_policy_rules")
    .select("rule_key,name,source_policy_name,action,severity,control_type,enforceability,condition_description,reasoning,confidence,version")
    .eq("company_slug", companySlug)
    .order("version", { ascending: false });
  const lookup: PolicyLookup = new Map();
  for (const row of data || []) {
    if (typeof row.rule_key !== "string" || lookup.has(row.rule_key)) continue;
    lookup.set(row.rule_key, {
      name: typeof row.name === "string" && row.name ? row.name : labelize(row.rule_key),
      source: typeof row.source_policy_name === "string" && row.source_policy_name ? row.source_policy_name : undefined,
      action: typeof row.action === "string" ? row.action : undefined,
      severity: typeof row.severity === "string" ? row.severity : undefined,
      controlType: typeof row.control_type === "string" ? row.control_type : undefined,
      enforceability: typeof row.enforceability === "string" ? row.enforceability : undefined,
      condition: typeof row.condition_description === "string" && row.condition_description ? row.condition_description : undefined,
      reasoning: typeof row.reasoning === "string" && row.reasoning ? row.reasoning : undefined,
      confidence: typeof row.confidence === "number" ? row.confidence : undefined
    });
  }
  return lookup;
}

function normalizeExtensionRows(rows: Array<Record<string, unknown>>): ExtensionUserRow[] {
  return rows.flatMap((row) => typeof row.id === "string" ? [{
    id: row.id,
    auth_user_id: typeof row.auth_user_id === "string" ? row.auth_user_id : null,
    department: typeof row.department === "string" ? row.department : null,
    surface: typeof row.surface === "string" ? row.surface : null,
    last_seen_at: typeof row.last_seen_at === "string" ? row.last_seen_at : null
  }] : []);
}

function applyDetailBounds<T extends { gte: (column: string, value: string) => T; lt: (column: string, value: string) => T }>(query: T, start: Date, before?: string) {
  const bounded = query.gte("created_at", start.toISOString());
  return before ? bounded.lt("created_at", before) : bounded;
}

function surfaceBreakdown(events: RawOrganizationEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (!isSummaryEvent(event)) continue;
    const surface = stringValue(event.surface) || "unknown";
    counts.set(surface, (counts.get(surface) || 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function percentage(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function entityCounts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([type, count]) => {
    const numericCount = typeof count === "number" && Number.isFinite(count) ? count : 0;
    return numericCount > 0 ? [{ type, count: numericCount }] : [];
  }).sort((a, b) => b.count - a.count).slice(0, 20);
}

function displayNameFromEmail(email: string) {
  const local = email.split("@")[0] || "Member";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelize(value: string) {
  return value.replace(/^accord[._-]/, "").replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
