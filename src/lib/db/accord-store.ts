import "server-only";

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ChatGatewayResponse, ChatRiskFlag } from "@/lib/chat/types";
import type { GovernanceEvent, ProviderName, RiskLevel, Stat } from "@/lib/mock-data";
import { dashboardStats } from "@/lib/mock-data";

type StoredGovernanceEventRow = {
  id: string;
  created_at: string;
  category: string;
  severity: RiskLevel;
  action_taken: string;
  status: string;
  provider: ProviderName;
  user_label: string;
  risk_score: number;
  redacted_preview: string;
  flags: string[] | null;
  policy_triggered: string;
  recommended_action: string;
};

type StoredMemoryRow = {
  id: string;
  title: string;
  kind: string;
  summary: string;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMemoryItem = {
  id: string;
  title: string;
  kind: string;
  summary: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
};

export type PolicyRuleStatus = "draft" | "approved" | "rejected" | "archived";
export type PolicyRuleAction = "allow" | "transform" | "warn" | "require_approval" | "block";
export type PolicyDestinationType = "any" | "approved" | "enterprise" | "personal" | "unapproved";

export type AccordPolicyRule = {
  id: string;
  companySlug: string;
  ruleKey: string;
  version: number;
  name: string;
  sourcePolicyName: string;
  sourceSection: string;
  supportingExcerpt: string;
  dataCategories: string[];
  userScope: string;
  departmentScope: string;
  aiProvider: string;
  destinationType: PolicyDestinationType;
  action: PolicyRuleAction;
  fallbackAction: PolicyRuleAction;
  severity: RiskLevel;
  employeeExplanation: string;
  effectiveDate: string;
  status: PolicyRuleStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  archivedAt?: string;
  publishedInLatestBundle?: boolean;
  publishedInBundleVersion?: number;
};

export type PolicyRuleDraftInput = {
  name?: string;
  ruleKey?: string;
  sourcePolicyName?: string;
  sourceSection?: string;
  supportingExcerpt?: string;
  dataCategories?: string[] | string;
  userScope?: string;
  departmentScope?: string;
  aiProvider?: string;
  destinationType?: PolicyDestinationType;
  action?: PolicyRuleAction;
  fallbackAction?: PolicyRuleAction;
  severity?: RiskLevel;
  employeeExplanation?: string;
  effectiveDate?: string;
};

export type PublishedPolicyBundle = {
  id: string;
  companySlug: string;
  version: number;
  status: "published" | "superseded";
  checksum: string;
  ruleCount: number;
  publishedAt: string;
  supersededAt?: string;
  rules: PublishedPolicyBundleRule[];
};

export type PublishedPolicyBundleRule = {
  id: string;
  ruleKey: string;
  version: number;
  name: string;
  sourcePolicyName: string;
  sourceSection: string;
  supportingExcerpt: string;
  dataCategories: string[];
  userScope: string;
  departmentScope: string;
  aiProvider: string;
  destinationType: PolicyDestinationType;
  action: PolicyRuleAction;
  fallbackAction: PolicyRuleAction;
  severity: RiskLevel;
  employeeExplanation: string;
  effectiveDate: string;
};

export type PolicyAdminSnapshot = {
  enabled: boolean;
  canMutate: boolean;
  notice?: string;
  rules: AccordPolicyRule[];
  latestBundle?: PublishedPolicyBundle;
  bundles: PublishedPolicyBundle[];
  counts: Record<PolicyRuleStatus, number>;
};

export type AccordDatabaseSnapshot = {
  memory: WorkspaceMemoryItem[];
  recentEvents: GovernanceEvent[];
  stats: Stat[];
  charts: DashboardChartData;
  databaseEnabled: boolean;
  extensionTelemetryEnabled: boolean;
  extensionMetrics: ExtensionTelemetryMetrics;
  timeRange: DashboardTimeRange;
  provider: "supabase";
};

export type DashboardChartData = {
  usageOverTime: Array<{
    day: string;
    requests: number;
    flagged: number;
  }>;
  riskDistribution: Array<{
    name: string;
    value: number;
    count: number;
    color: string;
  }>;
  providerUsage: Array<{
    name: string;
    requests: number;
  }>;
  riskCategories: Array<{
    name: string;
    events: number;
  }>;
};

export type ExtensionTelemetryEventType =
  | "message_sent_to_ai"
  | "message_blocked"
  | "attachment_governed"
  | "attachment_blocked"
  | "assistant_response_rehydrated"
  | "extension_error";

export type ExtensionTelemetryAction =
  | "allow"
  | "warn"
  | "redact"
  | "block"
  | "clean"
  | "redacted"
  | "blocked"
  | "unsupported"
  | "too_large"
  | "failed"
  | "binary";

export type ExtensionTelemetryPayload = {
  eventType: ExtensionTelemetryEventType;
  surface?: string;
  companySlug?: string;
  companyName?: string;
  userLabel?: string;
  extensionInstallId?: string;
  conversationKey?: string;
  action?: ExtensionTelemetryAction;
  riskScore?: number;
  riskLevel?: RiskLevel;
  flags?: string[];
  entityCounts?: Record<string, number>;
  redactionCount?: number;
  attachmentCount?: number;
  messageLengthBucket?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  organizationId?: string;
  employeeUserId?: string;
  ruleId?: string;
  ruleKey?: string;
  ruleVersion?: number;
  policyBundleVersion?: number;
  policyAction?: string;
  policySeverity?: string;
  aiProvider?: string;
  destinationType?: string;
  contentType?: string;
  detectedCategories?: string[];
};

export type ExtensionTelemetryMetrics = {
  governedEvents: number;
  messagesSent: number;
  messagesRedacted: number;
  messagesBlocked: number;
  policyViolations: number;
  governedUploads: number;
  protectedIdentifiers: number;
  activeUsers: number;
};

export type DashboardTimeRange = "7d" | "30d" | "all";

type DashboardTimeWindow = {
  range: DashboardTimeRange;
  start?: Date;
};

let supabaseClient: SupabaseClient | null = null;

const seedMemoryItems = [
  {
    id: "mem_product_context",
    title: "Accord product context",
    kind: "product_memory",
    summary:
      "Accord is an AI governance and compliance platform. It routes employee AI usage through governed controls, scans prompts and attachments before and after model calls, redacts sensitive identifiers, and keeps audit-ready metadata without broad raw-content storage.",
    source: "seed"
  },
  {
    id: "mem_privacy_boundary",
    title: "Governance without surveillance",
    kind: "principle",
    summary:
      "Store metadata, risk flags, policy decisions, redacted prompt previews, redacted response previews, and audit events by default. Do not store raw prompts, raw responses, original binary documents, or provider API keys in chat logs.",
    source: "seed"
  },
  {
    id: "mem_guard_extension",
    title: "Accord Guard browser mode",
    kind: "milestone",
    summary:
      "The Chrome extension governs ChatGPT usage in browser mode: prompt redaction, governed attachment replacement, response rehydration, and local placeholder vaults scoped to the session.",
    source: "seed"
  }
];

export async function getAccordDatabaseSnapshot(
  companySlug = "test-company",
  timeRange: DashboardTimeRange = "7d"
): Promise<AccordDatabaseSnapshot> {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return fallbackSnapshot();

    const timeWindow = dashboardTimeWindow(timeRange);
    await seedWorkspaceMemory(supabase);
    await seedTestCompany(supabase, companySlug, companySlug === "test-company" ? "Test Company" : titleFromSlug(companySlug)).catch(() => false);
    const memory = await getWorkspaceMemoryRows(supabase);
    const extensionMetrics = await getExtensionTelemetryMetrics(supabase, companySlug, timeWindow);
    const recentEvents = await getRecentEvents(supabase, 8, companySlug, timeWindow);
    const charts = await getDashboardChartData(supabase, companySlug, timeWindow);
    const stats = buildDatabaseStats(extensionMetrics);

    return {
      memory,
      recentEvents,
      stats,
      charts,
      databaseEnabled: true,
      extensionTelemetryEnabled: extensionMetrics.enabled,
      extensionMetrics: extensionMetrics.metrics,
      timeRange,
      provider: "supabase"
    };
  } catch {
    return fallbackSnapshot();
  }
}

export function normalizeDashboardTimeRange(value: unknown): DashboardTimeRange {
  const input = Array.isArray(value) ? value[0] : value;
  return input === "30d" || input === "all" ? input : "7d";
}

export async function persistChatGatewayRun(input: unknown, response: ChatGatewayResponse) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    await seedWorkspaceMemory(supabase);
    await seedTestCompany(supabase);
    const now = new Date().toISOString();
    const request = normalizePersistableRequest(input);
    const sessionId = request.conversationId || randomId("session");
    const title = titleFromPreview(response.redactedPromptPreview);

    const sessionResult = await supabase.from("accord_chat_sessions").upsert(
      {
        id: sessionId,
        title,
        tenant: "Northstar Financial",
        updated_at: now
      },
      { onConflict: "id" }
    );
    if (sessionResult.error) throw sessionResult.error;

    const messageResult = await supabase.from("accord_chat_messages").insert([
      {
        id: randomId("msg"),
        session_id: sessionId,
        role: "user",
        provider_id: response.provider.id,
        provider_label: response.provider.label,
        model: response.provider.selectedModel,
        redacted_preview: response.redactedPromptPreview,
        raw_stored: false,
        risk_score: response.riskScore,
        policy_action: response.policyDecision.action,
        created_at: now
      },
      {
        id: randomId("msg"),
        session_id: sessionId,
        role: "assistant",
        provider_id: response.provider.id,
        provider_label: response.provider.label,
        model: response.provider.model,
        redacted_preview: response.postResponse.redactedResponsePreview,
        raw_stored: false,
        risk_score: response.postResponse.riskScore,
        policy_action: response.policyDecision.action,
        created_at: now
      }
    ]);
    if (messageResult.error) throw messageResult.error;

    const flags = response.flags.map((flag) => flag.label || flag.type);
    const event = buildGovernanceEventForResponse(sessionId, response, flags, request);
    const governanceResult = await supabase.from("accord_governance_events").insert({
      id: event.id,
      session_id: sessionId,
      category: event.category,
      severity: event.severity,
      action_taken: event.actionTaken,
      status: event.status,
      provider: event.provider,
      user_label: event.user,
      risk_score: event.riskScore,
      redacted_preview: event.redactedPromptPreview,
      flags: event.flags,
      policy_triggered: event.policyTriggered,
      recommended_action: event.recommendedAction,
      metadata: {
        provider: response.provider,
        policyDecision: response.policyDecision,
        loggingBehavior: response.loggingBehavior,
        attachmentCount: response.attachmentResults.length,
        rawPromptStored: false,
        rawResponseStored: false
      },
      created_at: now
    });
    if (governanceResult.error) throw governanceResult.error;

    if (response.auditTrailEvents.length) {
      const auditResult = await supabase.from("accord_audit_events").insert(
        response.auditTrailEvents.map((auditEvent) => ({
          id: auditEvent.id || randomId("audit"),
          session_id: sessionId,
          event_type: auditEvent.type,
          message: auditEvent.message,
          metadata: auditEvent.metadata || {},
          created_at: auditEvent.timestamp || now
        }))
      );
      if (auditResult.error) throw auditResult.error;
    }
  } catch (error) {
    console.warn("[Accord Supabase] failed to persist chat gateway run", error);
  }
}

export async function recordExtensionTelemetryEvent(input: unknown) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      recorded: false,
      reason: "Supabase is not configured."
    };
  }

  const payload = normalizeExtensionTelemetryPayload(input);
  const testCompanyReady = await seedTestCompany(supabase, payload.companySlug, payload.companyName);
  if (!testCompanyReady) {
    throw new Error("Accord extension telemetry tables are not ready. Run the latest Supabase migration.");
  }

  const userId = randomId("ext_user");
  const now = new Date().toISOString();
  const userResult = await supabase.from("accord_extension_users").upsert(
    {
      id: userId,
      company_slug: payload.companySlug,
      extension_install_id: payload.extensionInstallId,
      user_label: payload.userLabel,
      surface: payload.surface,
      created_at: now,
      last_seen_at: now
    },
    { onConflict: "company_slug,extension_install_id", ignoreDuplicates: true }
  );
  if (userResult.error) throw userResult.error;

  const userUpdate = await supabase
    .from("accord_extension_users")
    .update({
      user_label: payload.userLabel,
      surface: payload.surface,
      last_seen_at: now
    })
    .eq("company_slug", payload.companySlug)
    .eq("extension_install_id", payload.extensionInstallId);
  if (userUpdate.error) throw userUpdate.error;

  const userLookup = await supabase
    .from("accord_extension_users")
    .select("id")
    .eq("company_slug", payload.companySlug)
    .eq("extension_install_id", payload.extensionInstallId)
    .maybeSingle();
  if (userLookup.error) throw userLookup.error;

  const eventId = randomId("guard_evt");
  const eventResult = await supabase.from("accord_extension_events").insert({
    id: eventId,
    company_slug: payload.companySlug,
    extension_user_id: typeof userLookup.data?.id === "string" ? userLookup.data.id : userId,
    event_type: payload.eventType,
    surface: payload.surface,
    conversation_key_hash: hashConversationKey(payload.conversationKey),
    action: payload.action,
    risk_score: payload.riskScore,
    risk_level: payload.riskLevel,
    flags: payload.flags,
    entity_counts: payload.entityCounts,
    redaction_count: payload.redactionCount,
    attachment_count: payload.attachmentCount,
    message_length_bucket: payload.messageLengthBucket,
    organization_id: payload.organizationId,
    employee_user_id: payload.employeeUserId,
    rule_id: payload.ruleId || null,
    rule_key: payload.ruleKey || null,
    rule_version: payload.ruleVersion || null,
    policy_bundle_version: payload.policyBundleVersion || null,
    policy_action: payload.policyAction || null,
    policy_severity: payload.policySeverity || null,
    ai_provider: payload.aiProvider,
    destination_type: payload.destinationType,
    content_type: payload.contentType,
    detected_categories: payload.detectedCategories,
    metadata: payload.metadata,
    created_at: payload.occurredAt
  });
  if (eventResult.error) throw eventResult.error;

  return {
    recorded: true,
    eventId
  };
}

export async function getPolicyAdminSnapshot(companySlug = "test-company"): Promise<PolicyAdminSnapshot> {
  const empty: PolicyAdminSnapshot = {
    enabled: false,
    canMutate: false,
    rules: [],
    bundles: [],
    counts: {
      draft: 0,
      approved: 0,
      rejected: 0,
      archived: 0
    }
  };

  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return empty;

    const ready = await ensurePolicyStore(supabase, companySlug);
    if (!ready) return fallbackPolicyAdminSnapshot(companySlug);

    const [rulesResult, bundlesResult] = await Promise.all([
      supabase
        .from("accord_policy_rules")
        .select("*")
        .eq("company_slug", companySlug)
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("accord_policy_bundles")
        .select("*")
        .eq("company_slug", companySlug)
        .order("version", { ascending: false })
        .limit(10)
    ]);

    if (rulesResult.error) throw rulesResult.error;
    if (bundlesResult.error) throw bundlesResult.error;

    const bundles = ((bundlesResult.data || []) as Array<Record<string, unknown>>).map(toPolicyBundle);
    const latestBundle = bundles.find((bundle) => bundle.status === "published");
    const rules = attachPublishedBundleState(((rulesResult.data || []) as Array<Record<string, unknown>>).map(toPolicyRule), latestBundle);
    const counts = rules.reduce<PolicyAdminSnapshot["counts"]>(
      (memo, rule) => {
        memo[rule.status] += 1;
        return memo;
      },
      { draft: 0, approved: 0, rejected: 0, archived: 0 }
    );

    return {
      enabled: true,
      canMutate: true,
      rules,
      bundles,
      counts,
      latestBundle
    };
  } catch {
    return empty;
  }
}

export async function createPolicyRuleFromForm(formData: FormData, companySlug = "test-company") {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const ready = await ensurePolicyStore(supabase, companySlug);
  if (!ready) return;

  const draft = policyRuleDraftFromForm(formData, companySlug);
  const version = await getNextPolicyRuleVersion(supabase, companySlug, draft.rule_key);
  const result = await supabase.from("accord_policy_rules").insert({
    ...draft,
    id: randomId("rule"),
    version,
    status: "draft",
    active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  if (result.error) throw result.error;
}

export async function createPolicyRulesFromInputs(inputs: PolicyRuleDraftInput[], companySlug = "test-company") {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const ready = await ensurePolicyStore(supabase, companySlug);
  if (!ready) throw new Error("Policy tables are not ready.");

  const created: Array<{ id: string; name: string; ruleKey: string; version: number }> = [];

  for (const input of inputs.slice(0, 12)) {
    const draft = policyRuleDraftFromInput(input, companySlug);
    const version = await getNextPolicyRuleVersion(supabase, companySlug, draft.rule_key);
    const id = randomId("rule");
    const result = await supabase.from("accord_policy_rules").insert({
      ...draft,
      id,
      version,
      status: "draft",
      active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (result.error) throw result.error;
    created.push({
      id,
      name: draft.name,
      ruleKey: draft.rule_key,
      version
    });
  }

  return created;
}

export async function updateDraftPolicyRuleFromForm(id: string, formData: FormData) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const current = await supabase.from("accord_policy_rules").select("status").eq("id", id).maybeSingle();
  if (current.error) throw current.error;
  if (current.data?.status !== "draft") throw new Error("Only draft rules can be edited.");

  const draft = policyRuleDraftFromForm(formData, "test-company");
  const { company_slug: _companySlug, ...patch } = draft;
  const result = await supabase
    .from("accord_policy_rules")
    .update({
      ...patch,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  if (result.error) throw result.error;
}

export async function setPolicyRuleStatus(id: string, status: PolicyRuleStatus) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const current = await supabase.from("accord_policy_rules").select("company_slug,rule_key").eq("id", id).maybeSingle();
  if (current.error) throw current.error;

  if (status === "approved" && current.data) {
    const deactivateResult = await supabase
      .from("accord_policy_rules")
      .update({
        active: false,
        updated_at: new Date().toISOString()
      })
      .eq("company_slug", current.data.company_slug)
      .eq("rule_key", current.data.rule_key)
      .neq("id", id);
    if (deactivateResult.error) throw deactivateResult.error;
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    active: status === "approved",
    updated_at: now,
    archived_at: status === "archived" ? now : null
  };

  if (status === "approved") patch.approved_at = now;
  if (status === "draft" || status === "rejected") patch.approved_at = null;

  const result = await supabase.from("accord_policy_rules").update(patch).eq("id", id);
  if (result.error) throw result.error;
}

export async function deletePolicyRule(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const current = await supabase.from("accord_policy_rules").select("status").eq("id", id).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) return;
  if (current.data.status === "approved") throw new Error("Archive approved rules before deleting them.");

  const result = await supabase.from("accord_policy_rules").delete().eq("id", id);
  if (result.error) throw result.error;
}

export async function publishPolicyBundle(companySlug = "test-company") {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const ready = await ensurePolicyStore(supabase, companySlug);
  if (!ready) return fallbackPublishedPolicyBundle(companySlug);

  const [rulesResult, latestBundle, latestPublishedBundleResult] = await Promise.all([
    supabase
      .from("accord_policy_rules")
      .select("*")
      .eq("company_slug", companySlug)
      .eq("status", "approved")
      .order("rule_key", { ascending: true })
      .order("version", { ascending: true }),
    supabase
      .from("accord_policy_bundles")
      .select("version")
      .eq("company_slug", companySlug)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("accord_policy_bundles")
      .select("*")
      .eq("company_slug", companySlug)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  if (rulesResult.error) throw rulesResult.error;
  if (latestBundle.error) throw latestBundle.error;
  if (latestPublishedBundleResult.error) throw latestPublishedBundleResult.error;

  const latestPublishedBundle = latestPublishedBundleResult.data ? toPolicyBundle(latestPublishedBundleResult.data as Record<string, unknown>) : undefined;
  const publishedRuleIds = new Set(latestPublishedBundle?.rules.map((rule) => rule.id) || []);
  const publishedRuleVersions = new Set(latestPublishedBundle?.rules.map((rule) => `${rule.ruleKey}:${rule.version}`) || []);
  const rules = latestPolicyRuleVersions(
    ((rulesResult.data || []) as Array<Record<string, unknown>>)
      .map(toPolicyRule)
      .filter((rule) => rule.active || publishedRuleIds.has(rule.id) || publishedRuleVersions.has(`${rule.ruleKey}:${rule.version}`))
  );
  if (!rules.length) throw new Error("Approve at least one policy rule before publishing.");

  const version = Math.max(0, typeof latestBundle.data?.version === "number" ? latestBundle.data.version : 0) + 1;
  const publishedAt = new Date().toISOString();
  const rulesForBundle = rules.map(policyRuleToBundleRule);
  const bundle = {
    schemaVersion: 1,
    companySlug,
    version,
    publishedAt,
    rules: rulesForBundle
  };
  const checksum = checksumJson(bundle);
  const id = `bundle_${companySlug}_${version}_${checksum.slice(0, 12)}`;

  const supersedeResult = await supabase
    .from("accord_policy_bundles")
    .update({
      status: "superseded",
      superseded_at: publishedAt
    })
    .eq("company_slug", companySlug)
    .eq("status", "published");
  if (supersedeResult.error) throw supersedeResult.error;

  const insertResult = await supabase.from("accord_policy_bundles").insert({
    id,
    company_slug: companySlug,
    version,
    status: "published",
    checksum,
    rule_count: rulesForBundle.length,
    bundle: {
      ...bundle,
      id,
      checksum
    },
    published_at: publishedAt
  });
  if (insertResult.error) throw insertResult.error;

  return {
    id,
    version,
    checksum
  };
}

export async function getLatestPublishedPolicyBundle(companySlug = "test-company") {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const ready = await ensurePolicyStore(supabase, companySlug);
  if (!ready) return fallbackPublishedPolicyBundle(companySlug);

  const result = await supabase
    .from("accord_policy_bundles")
    .select("*")
    .eq("company_slug", companySlug)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    if (isMissingSupabaseRelation(result.error)) return null;
    throw result.error;
  }
  if (!result.data) return null;
  return toPolicyBundle(result.data as Record<string, unknown>);
}

export function getSupabaseServerClient() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" })
    }
  });

  return supabaseClient;
}

async function seedWorkspaceMemory(supabase: SupabaseClient) {
  const now = new Date().toISOString();
  const result = await supabase.from("accord_workspace_memory").upsert(
    seedMemoryItems.map((item) => ({
      ...item,
      created_at: now,
      updated_at: now
    })),
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (result.error) throw result.error;
}

async function seedTestCompany(supabase: SupabaseClient, slug = "test-company", name = "Test Company") {
  const result = await supabase.from("accord_companies").upsert(
    {
      slug,
      name,
      updated_at: new Date().toISOString()
    },
    { onConflict: "slug" }
  );

  if (result.error) {
    if (isMissingSupabaseRelation(result.error)) return false;
    throw result.error;
  }

  return true;
}

async function ensurePolicyStore(supabase: SupabaseClient, companySlug = "test-company") {
  const companyReady = await seedTestCompany(supabase, companySlug, companySlug === "test-company" ? "Test Company" : titleFromSlug(companySlug));
  if (!companyReady) return false;

  const seedResult = await supabase.from("accord_policy_rules").upsert(
    developmentPolicyRule(companySlug),
    { onConflict: "company_slug,rule_key,version", ignoreDuplicates: true }
  );

  if (seedResult.error) {
    if (isMissingSupabaseRelation(seedResult.error)) return false;
    throw seedResult.error;
  }

  return true;
}

async function getNextPolicyRuleVersion(supabase: SupabaseClient, companySlug: string, ruleKey: string) {
  const result = await supabase
    .from("accord_policy_rules")
    .select("version")
    .eq("company_slug", companySlug)
    .eq("rule_key", ruleKey)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return Math.max(0, typeof result.data?.version === "number" ? result.data.version : 0) + 1;
}

function developmentPolicyRule(companySlug = "test-company") {
  return {
    id: "rule_external_ai_client_info_v1",
    company_slug: companySlug,
    rule_key: "external_ai_client_info",
    version: 1,
    name: "Do not submit client identifiers to personal AI",
    source_policy_name: "External AI Usage Policy",
    source_section: "4.2 - Client Information",
    supporting_excerpt:
      "Employees must not submit client names, addresses, account numbers, veterinary medical records, payment information, or other identifying information to personal or unapproved AI services. When identifying information can be removed without preventing the task, it must be removed before submission. If adequate de-identification is not possible, the submission must be blocked or routed for approval.",
    data_categories: [
      "client_identifying_info",
      "personal_data",
      "address",
      "account",
      "veterinary_medical_record",
      "payment_information"
    ],
    user_scope: "all",
    department_scope: "all",
    ai_provider: "chatgpt",
    destination_type: "personal",
    action: "transform",
    fallback_action: "block",
    severity: "high",
    employee_explanation:
      "Client identifying information cannot be sent to personal AI. Accord will remove identifiers when it can do so safely, otherwise the submission is blocked or routed for approval.",
    effective_date: new Date().toISOString().slice(0, 10),
    status: "approved",
    active: true,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function fallbackPolicyAdminSnapshot(companySlug = "test-company"): PolicyAdminSnapshot {
  const rule = {
    ...toPolicyRule(developmentPolicyRule(companySlug)),
    publishedInLatestBundle: true,
    publishedInBundleVersion: 1
  };
  const bundle = fallbackPublishedPolicyBundle(companySlug);

  return {
    enabled: true,
    canMutate: false,
    rules: [rule],
    latestBundle: bundle,
    bundles: [bundle],
    counts: {
      draft: 0,
      approved: 1,
      rejected: 0,
      archived: 0
    }
  };
}

function fallbackPublishedPolicyBundle(companySlug = "test-company"): PublishedPolicyBundle {
  const rule = toPolicyRule(developmentPolicyRule(companySlug));
  const rules = [policyRuleToBundleRule(rule)];
  const version = 1;
  const publishedAt = rule.approvedAt || new Date().toISOString();
  const bundleCore = {
    schemaVersion: 1,
    companySlug,
    version,
    publishedAt,
    rules
  };
  const checksum = checksumJson(bundleCore);

  return {
    id: `bundle_${companySlug}_${version}_${checksum.slice(0, 12)}`,
    companySlug,
    version,
    status: "published",
    checksum,
    ruleCount: rules.length,
    publishedAt,
    rules
  };
}

function attachPublishedBundleState(rules: AccordPolicyRule[], latestBundle?: PublishedPolicyBundle) {
  if (!latestBundle) return rules;

  const publishedIds = new Set(latestBundle.rules.map((rule) => rule.id));
  const publishedVersions = new Set(latestBundle.rules.map((rule) => `${rule.ruleKey}:${rule.version}`));

  return rules.map((rule) => {
    const publishedInLatestBundle = publishedIds.has(rule.id) || publishedVersions.has(`${rule.ruleKey}:${rule.version}`);

    return {
      ...rule,
      publishedInLatestBundle,
      publishedInBundleVersion: publishedInLatestBundle ? latestBundle.version : undefined
    };
  });
}

function policyRuleDraftFromForm(formData: FormData, companySlug: string) {
  return policyRuleDraftFromInput(
    {
      ruleKey: readFormString(formData, "ruleKey"),
      name: readFormString(formData, "name"),
      sourcePolicyName: readFormString(formData, "sourcePolicyName"),
      sourceSection: readFormString(formData, "sourceSection"),
      supportingExcerpt: readFormString(formData, "supportingExcerpt"),
      dataCategories: readFormList(formData, "dataCategories"),
      userScope: readFormString(formData, "userScope"),
      departmentScope: readFormString(formData, "departmentScope"),
      aiProvider: readFormString(formData, "aiProvider"),
      destinationType: normalizeDestinationType(readFormString(formData, "destinationType")),
      action: normalizePolicyAction(readFormString(formData, "action")),
      fallbackAction: normalizePolicyAction(readFormString(formData, "fallbackAction")),
      severity: normalizeRiskLevel(readFormString(formData, "severity"), 0),
      employeeExplanation: readFormString(formData, "employeeExplanation"),
      effectiveDate: readFormString(formData, "effectiveDate")
    },
    companySlug
  );
}

function policyRuleDraftFromInput(input: PolicyRuleDraftInput, companySlug: string) {
  const ruleKey = slugify(input.ruleKey || input.name || "policy-rule").replace(/-/g, "_");

  return {
    company_slug: companySlug,
    rule_key: ruleKey,
    name: clampString(input.name, 300) || "Untitled policy rule",
    source_policy_name: clampString(input.sourcePolicyName, 300) || "External AI Usage Policy",
    source_section: clampString(input.sourceSection, 300) || "Imported policy section",
    supporting_excerpt: clampString(input.supportingExcerpt, 3000),
    data_categories: normalizePolicyDataCategories(input.dataCategories),
    user_scope: clampString(input.userScope, 160) || "all",
    department_scope: clampString(input.departmentScope, 160) || "all",
    ai_provider: clampString(input.aiProvider, 80) || "chatgpt",
    destination_type: normalizeDestinationType(input.destinationType),
    action: normalizePolicyAction(input.action),
    fallback_action: normalizePolicyAction(input.fallbackAction),
    severity: normalizeRiskLevel(input.severity, 0),
    employee_explanation: clampString(input.employeeExplanation, 1500) || "Accord applied a company AI usage policy.",
    effective_date: clampString(input.effectiveDate, 20) || new Date().toISOString().slice(0, 10)
  };
}

function normalizePolicyDataCategories(value: PolicyRuleDraftInput["dataCategories"]) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,]/) : [];
  return values
    .map((item) => slugify(item).replace(/-/g, "_"))
    .filter(Boolean)
    .slice(0, 40);
}

function toPolicyRule(row: Record<string, unknown>): AccordPolicyRule {
  return {
    id: stringValue(row.id),
    companySlug: stringValue(row.company_slug),
    ruleKey: stringValue(row.rule_key),
    version: numberValue(row.version, 1),
    name: stringValue(row.name),
    sourcePolicyName: stringValue(row.source_policy_name),
    sourceSection: stringValue(row.source_section),
    supportingExcerpt: stringValue(row.supporting_excerpt),
    dataCategories: normalizeStringArray(row.data_categories, 40),
    userScope: stringValue(row.user_scope) || "all",
    departmentScope: stringValue(row.department_scope) || "all",
    aiProvider: stringValue(row.ai_provider) || "any",
    destinationType: normalizeDestinationType(stringValue(row.destination_type)),
    action: normalizePolicyAction(stringValue(row.action)),
    fallbackAction: normalizePolicyAction(stringValue(row.fallback_action)),
    severity: normalizeRiskLevel(row.severity, 0),
    employeeExplanation: stringValue(row.employee_explanation),
    effectiveDate: stringValue(row.effective_date),
    status: normalizePolicyRuleStatus(row.status),
    active: row.active === true,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    approvedAt: typeof row.approved_at === "string" ? row.approved_at : undefined,
    archivedAt: typeof row.archived_at === "string" ? row.archived_at : undefined
  };
}

function toPolicyBundle(row: Record<string, unknown>): PublishedPolicyBundle {
  const bundle = isRecord(row.bundle) ? row.bundle : {};
  const rules = Array.isArray(bundle.rules) ? bundle.rules.filter(isRecord).map(toBundleRule) : [];

  return {
    id: stringValue(row.id || bundle.id),
    companySlug: stringValue(row.company_slug || bundle.companySlug),
    version: numberValue(row.version || bundle.version, 0),
    status: row.status === "superseded" ? "superseded" : "published",
    checksum: stringValue(row.checksum || bundle.checksum),
    ruleCount: numberValue(row.rule_count, rules.length),
    publishedAt: stringValue(row.published_at || bundle.publishedAt),
    supersededAt: typeof row.superseded_at === "string" ? row.superseded_at : undefined,
    rules
  };
}

function toBundleRule(row: Record<string, unknown>): PublishedPolicyBundleRule {
  return {
    id: stringValue(row.id),
    ruleKey: stringValue(row.ruleKey || row.rule_key),
    version: numberValue(row.version, 1),
    name: stringValue(row.name),
    sourcePolicyName: stringValue(row.sourcePolicyName || row.source_policy_name),
    sourceSection: stringValue(row.sourceSection || row.source_section),
    supportingExcerpt: stringValue(row.supportingExcerpt || row.supporting_excerpt),
    dataCategories: normalizeStringArray(row.dataCategories || row.data_categories, 40),
    userScope: stringValue(row.userScope || row.user_scope) || "all",
    departmentScope: stringValue(row.departmentScope || row.department_scope) || "all",
    aiProvider: stringValue(row.aiProvider || row.ai_provider) || "any",
    destinationType: normalizeDestinationType(stringValue(row.destinationType || row.destination_type)),
    action: normalizePolicyAction(stringValue(row.action)),
    fallbackAction: normalizePolicyAction(stringValue(row.fallbackAction || row.fallback_action)),
    severity: normalizeRiskLevel(row.severity, 0),
    employeeExplanation: stringValue(row.employeeExplanation || row.employee_explanation),
    effectiveDate: stringValue(row.effectiveDate || row.effective_date)
  };
}

function policyRuleToBundleRule(rule: AccordPolicyRule): PublishedPolicyBundleRule {
  return {
    id: rule.id,
    ruleKey: rule.ruleKey,
    version: rule.version,
    name: rule.name,
    sourcePolicyName: rule.sourcePolicyName,
    sourceSection: rule.sourceSection,
    supportingExcerpt: rule.supportingExcerpt,
    dataCategories: rule.dataCategories,
    userScope: rule.userScope,
    departmentScope: rule.departmentScope,
    aiProvider: rule.aiProvider,
    destinationType: rule.destinationType,
    action: rule.action,
    fallbackAction: rule.fallbackAction,
    severity: rule.severity,
    employeeExplanation: rule.employeeExplanation,
    effectiveDate: rule.effectiveDate
  };
}

function latestPolicyRuleVersions(rules: AccordPolicyRule[]) {
  const byRuleKey = new Map<string, AccordPolicyRule>();

  for (const rule of rules) {
    const current = byRuleKey.get(rule.ruleKey);
    if (!current || rule.version > current.version) byRuleKey.set(rule.ruleKey, rule);
  }

  return Array.from(byRuleKey.values()).sort((a, b) => a.ruleKey.localeCompare(b.ruleKey));
}

async function getWorkspaceMemoryRows(supabase: SupabaseClient): Promise<WorkspaceMemoryItem[]> {
  const { data, error } = await supabase
    .from("accord_workspace_memory")
    .select("id,title,kind,summary,source,created_at,updated_at")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data || []) as StoredMemoryRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    summary: row.summary,
    source: row.source || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function getRecentEvents(
  supabase: SupabaseClient,
  limit: number,
  companySlug: string,
  timeWindow: DashboardTimeWindow
): Promise<GovernanceEvent[]> {
  const extensionEvents = await getRecentExtensionEventRows(supabase, limit, companySlug, timeWindow);

  return extensionEvents
    .sort((a, b) => eventSortTime(b.occurredAt) - eventSortTime(a.occurredAt))
    .slice(0, limit);
}

async function getRecentGovernanceEventRows(supabase: SupabaseClient, limit: number): Promise<GovernanceEvent[]> {
  const { data, error } = await supabase
    .from("accord_governance_events")
    .select("id,created_at,category,severity,action_taken,status,provider,user_label,risk_score,redacted_preview,flags,policy_triggered,recommended_action")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data || []) as StoredGovernanceEventRow[];

  return rows.map((row) => ({
    id: row.id,
    time: formatEventTime(row.created_at),
    occurredAt: row.created_at,
    department: "Accord Chat",
    user: row.user_label,
    provider: row.provider,
    severity: row.severity,
    category: row.category,
    actionTaken: row.action_taken,
    status: row.status,
    riskScore: row.risk_score,
    redactedPromptPreview: row.redacted_preview,
    flags: Array.isArray(row.flags) ? row.flags : [],
    policyTriggered: row.policy_triggered,
    recommendedAction: row.recommended_action
  }));
}

async function getRecentExtensionEventRows(
  supabase: SupabaseClient,
  limit: number,
  companySlug: string,
  timeWindow: DashboardTimeWindow
): Promise<GovernanceEvent[]> {
  let query = supabase
    .from("accord_extension_events")
    .select("id,created_at,event_type,action,risk_score,risk_level,flags,redaction_count,attachment_count,message_length_bucket,metadata")
    .eq("company_slug", companySlug)
    .or("event_type.eq.message_blocked,event_type.eq.attachment_blocked,action.eq.redact,action.eq.warn,action.eq.block,action.eq.redacted,action.eq.blocked");

  if (timeWindow.start) {
    query = query.gte("created_at", timeWindow.start.toISOString());
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

  if (error) return [];

  return (data || []).map((row) => {
    const metadata = isRecord(row.metadata) ? row.metadata : {};
    const flags = Array.isArray(row.flags) ? row.flags.filter((flag): flag is string => typeof flag === "string") : [];
    const riskScore = typeof row.risk_score === "number" ? row.risk_score : 0;
    const action = typeof row.action === "string" ? row.action : "allow";
    const eventType = typeof row.event_type === "string" ? row.event_type : "extension_event";

    return {
      id: typeof row.id === "string" ? row.id : randomId("event"),
      time: formatEventTime(typeof row.created_at === "string" ? row.created_at : new Date().toISOString()),
      occurredAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
      department: "Chrome extension",
      user: typeof metadata.userLabel === "string" ? metadata.userLabel : "Test user",
      provider: "OpenAI" as ProviderName,
      severity: riskLevel(riskScore),
      category: extensionCategory(eventType, action),
      actionTaken: extensionActionTaken(eventType, action),
      status: eventType.includes("blocked") ? "Blocked" : "Logged",
      riskScore,
      redactedPromptPreview: extensionPreview(eventType, metadata),
      flags: flags.length ? flags : [eventType.replace(/_/g, " ")],
      policyTriggered: extensionPolicyTriggered(eventType, action),
      recommendedAction: "Review aggregate extension telemetry. Raw prompts and source files are not stored."
    };
  });
}

async function getDashboardChartData(
  supabase: SupabaseClient,
  companySlug: string,
  timeWindow: DashboardTimeWindow
): Promise<DashboardChartData> {
  try {
    let extensionQuery = supabase
      .from("accord_extension_events")
      .select("created_at,event_type,action,risk_score,risk_level,flags")
      .eq("company_slug", companySlug)
      .order("created_at", { ascending: true });

    if (timeWindow.start) {
      extensionQuery = extensionQuery.gte("created_at", timeWindow.start.toISOString());
    }

    const extensionResult = await extensionQuery.limit(5000);

    const extensionRows = extensionResult.error ? [] : extensionResult.data || [];

    return {
      usageOverTime: buildUsageOverTime(extensionRows, [], timeWindow),
      riskDistribution: buildRiskDistribution(extensionRows, []),
      providerUsage: buildProviderUsage(extensionRows, []),
      riskCategories: buildRiskCategories(extensionRows, [])
    };
  } catch {
    return emptyDashboardChartData(timeWindow);
  }
}

function buildUsageOverTime(
  extensionRows: Array<Record<string, unknown>>,
  governanceRows: Array<Record<string, unknown>>,
  timeWindow: DashboardTimeWindow
) {
  const start = timeWindow.start || firstEventDay(extensionRows, governanceRows) || startOfLocalDay(daysAgo(6));
  const end = startOfLocalDay(new Date());
  const bucketCount = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      key: dateKey(date),
      day: dayLabel(date, bucketCount),
      requests: 0,
      flagged: 0
    };
  });
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const row of extensionRows) {
    const bucket = bucketMap.get(dateKeyFromUnknown(row.created_at));
    if (!bucket) continue;

    const eventType = typeof row.event_type === "string" ? row.event_type : "";
    const action = typeof row.action === "string" ? row.action : "";
    const riskScore = typeof row.risk_score === "number" ? row.risk_score : 0;

    if (eventType === "message_sent_to_ai" || eventType === "message_blocked") {
      bucket.requests += 1;
    }
    if (isPolicyViolationAction(action) || eventType === "message_blocked" || riskScore >= 35) {
      bucket.flagged += 1;
    }
  }

  for (const row of governanceRows) {
    const bucket = bucketMap.get(dateKeyFromUnknown(row.created_at));
    if (!bucket) continue;
    bucket.requests += 1;
    if (typeof row.risk_score === "number" && row.risk_score >= 35) {
      bucket.flagged += 1;
    }
  }

  return buckets.map(({ day, requests, flagged }) => ({ day, requests, flagged }));
}

function buildRiskDistribution(extensionRows: Array<Record<string, unknown>>, governanceRows: Array<Record<string, unknown>>) {
  const counts: Record<RiskLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  for (const row of extensionRows) {
    const eventType = typeof row.event_type === "string" ? row.event_type : "";
    if (eventType === "assistant_response_rehydrated") continue;
    const score = typeof row.risk_score === "number" ? row.risk_score : 0;
    const level = normalizeRiskLevel(row.risk_level, score);
    counts[level] += 1;
  }

  for (const row of governanceRows) {
    const score = typeof row.risk_score === "number" ? row.risk_score : 0;
    const level = normalizeRiskLevel(row.severity, score);
    counts[level] += 1;
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return [
    { name: "Low", count: counts.low, color: "#22c55e" },
    { name: "Medium", count: counts.medium, color: "#f59e0b" },
    { name: "High", count: counts.high, color: "#f97316" },
    { name: "Critical", count: counts.critical, color: "#ef4444" }
  ].map((item) => ({
    ...item,
    value: total ? Math.round((item.count / total) * 100) : 0
  }));
}

function buildProviderUsage(extensionRows: Array<Record<string, unknown>>, chatMessageRows: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>();
  const extensionMessages = extensionRows.filter((row) => {
    const eventType = typeof row.event_type === "string" ? row.event_type : "";
    return eventType === "message_sent_to_ai" || eventType === "message_blocked";
  }).length;
  if (extensionMessages) counts.set("ChatGPT", extensionMessages);

  for (const row of chatMessageRows) {
    const provider = typeof row.provider_label === "string" && row.provider_label.trim() ? row.provider_label.trim() : "Accord Chat";
    counts.set(provider, (counts.get(provider) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, requests]) => ({ name, requests }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 6);
}

function buildRiskCategories(extensionRows: Array<Record<string, unknown>>, governanceRows: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>();

  for (const row of extensionRows) {
    const action = typeof row.action === "string" ? row.action : "";
    const eventType = typeof row.event_type === "string" ? row.event_type : "";
    const riskScore = typeof row.risk_score === "number" ? row.risk_score : 0;
    if (!isPolicyViolationAction(action) && !eventType.includes("blocked") && riskScore < 35) continue;

    for (const category of categoriesFromFlags(row.flags, eventType, action)) {
      counts.set(category, (counts.get(category) || 0) + 1);
    }
  }

  for (const row of governanceRows) {
    const category = typeof row.category === "string" && row.category.trim() ? row.category.trim() : "Policy screened";
    counts.set(category, (counts.get(category) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, events]) => ({ name, events }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 6);
}

function buildDatabaseStats(extensionMetrics: { metrics: ExtensionTelemetryMetrics }): Stat[] {
  return dashboardStats.map((stat) => {
    if (stat.label === "Total AI requests") {
      return { ...stat, value: formatNumber(extensionMetrics.metrics.messagesSent), detail: "Messages submitted after Guard checks" };
    }
    if (stat.label === "High-risk events") {
      return { ...stat, value: formatNumber(extensionMetrics.metrics.policyViolations), detail: "Warn, redact, or block decisions" };
    }
    if (stat.label === "Blocked requests") {
      return { ...stat, value: formatNumber(extensionMetrics.metrics.messagesBlocked), detail: "Messages blocked before external AI" };
    }
    if (stat.label === "Active users") {
      return { ...stat, value: formatNumber(extensionMetrics.metrics.activeUsers), detail: "Extension users reporting telemetry" };
    }
    if (stat.label === "Estimated spend") {
      return { ...stat, value: "$0", detail: "Spend tracking not connected" };
    }
    return stat;
  });
}

async function getExtensionTelemetryMetrics(
  supabase: SupabaseClient,
  companySlug: string,
  timeWindow: DashboardTimeWindow
): Promise<{
  enabled: boolean;
  metrics: ExtensionTelemetryMetrics;
}> {
  const fallback = {
    enabled: false,
    metrics: emptyExtensionMetrics()
  };

  try {
    const [governedEvents, sent, redacted, blocked, violations, uploads, users, redactions] = await Promise.all([
      countGovernedExtensionEvents(supabase, companySlug, timeWindow),
      countExtensionEvents(supabase, companySlug, "message_sent_to_ai", timeWindow),
      countRedactedMessages(supabase, companySlug, timeWindow),
      countExtensionEvents(supabase, companySlug, "message_blocked", timeWindow),
      countExtensionViolations(supabase, companySlug, timeWindow),
      countExtensionUploads(supabase, companySlug, timeWindow),
      countExtensionUsers(supabase, companySlug, timeWindow),
      sumExtensionRedactions(supabase, companySlug, timeWindow)
    ]);

    return {
      enabled: true,
      metrics: {
        governedEvents,
        messagesSent: sent,
        messagesRedacted: redacted,
        messagesBlocked: blocked,
        policyViolations: violations,
        governedUploads: uploads,
        protectedIdentifiers: redactions,
        activeUsers: users
      }
    };
  } catch {
    return fallback;
  }
}

async function countGovernedExtensionEvents(supabase: SupabaseClient, companySlug: string, timeWindow: DashboardTimeWindow) {
  let query = supabase
    .from("accord_extension_events")
    .select("id", { count: "exact", head: true })
    .eq("company_slug", companySlug)
    .neq("event_type", "assistant_response_rehydrated");

  if (timeWindow.start) {
    query = query.gte("created_at", timeWindow.start.toISOString());
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function countExtensionEvents(
  supabase: SupabaseClient,
  companySlug: string,
  eventType: ExtensionTelemetryEventType,
  timeWindow: DashboardTimeWindow
) {
  let query = supabase
    .from("accord_extension_events")
    .select("id", { count: "exact", head: true })
    .eq("company_slug", companySlug)
    .eq("event_type", eventType);

  if (timeWindow.start) {
    query = query.gte("created_at", timeWindow.start.toISOString());
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function countRedactedMessages(supabase: SupabaseClient, companySlug: string, timeWindow: DashboardTimeWindow) {
  let query = supabase
    .from("accord_extension_events")
    .select("id", { count: "exact", head: true })
    .eq("company_slug", companySlug)
    .eq("event_type", "message_sent_to_ai")
    .in("action", ["redact", "redacted"]);

  if (timeWindow.start) {
    query = query.gte("created_at", timeWindow.start.toISOString());
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function countExtensionViolations(supabase: SupabaseClient, companySlug: string, timeWindow: DashboardTimeWindow) {
  let query = supabase
    .from("accord_extension_events")
    .select("id", { count: "exact", head: true })
    .eq("company_slug", companySlug)
    .in("action", ["warn", "redact", "block", "redacted", "blocked"]);

  if (timeWindow.start) {
    query = query.gte("created_at", timeWindow.start.toISOString());
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function countExtensionUploads(supabase: SupabaseClient, companySlug: string, timeWindow: DashboardTimeWindow) {
  let query = supabase
    .from("accord_extension_events")
    .select("id", { count: "exact", head: true })
    .eq("company_slug", companySlug)
    .in("event_type", ["attachment_governed", "attachment_blocked"]);

  if (timeWindow.start) {
    query = query.gte("created_at", timeWindow.start.toISOString());
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function countExtensionUsers(supabase: SupabaseClient, companySlug: string, timeWindow: DashboardTimeWindow) {
  let query = supabase
    .from("accord_extension_users")
    .select("id", { count: "exact", head: true })
    .eq("company_slug", companySlug);

  if (timeWindow.start) {
    query = query.gte("last_seen_at", timeWindow.start.toISOString());
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function sumExtensionRedactions(supabase: SupabaseClient, companySlug: string, timeWindow: DashboardTimeWindow) {
  let query = supabase
    .from("accord_extension_events")
    .select("redaction_count")
    .eq("company_slug", companySlug)
    .neq("event_type", "assistant_response_rehydrated");

  if (timeWindow.start) {
    query = query.gte("created_at", timeWindow.start.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).reduce((sum, row) => {
    const value = typeof row.redaction_count === "number" ? row.redaction_count : 0;
    return sum + value;
  }, 0);
}

function buildGovernanceEventForResponse(
  sessionId: string,
  response: ChatGatewayResponse,
  flags: string[],
  request: { useCase: string; sensitivity: string }
): GovernanceEvent {
  const category = categoryFromFlags(response.flags);
  const actionTaken = actionTakenFromPolicy(response.policyDecision.action);
  const status = response.policyDecision.action === "block" ? "Incident created" : response.policyDecision.requiresReview ? "Needs review" : "Resolved";

  return {
    id: randomId("evt"),
    time: "Now",
    department: request.useCase || "Accord Chat",
    user: "Employee",
    provider: providerName(response.provider.label),
    severity: riskLevel(response.riskScore),
    category,
    actionTaken,
    status,
    riskScore: response.riskScore,
    redactedPromptPreview: response.redactedPromptPreview,
    flags: flags.length ? flags : ["Policy screened"],
    policyTriggered: response.policyDecision.reason || `Policy action: ${response.policyDecision.action}`,
    recommendedAction:
      response.policyDecision.action === "block"
        ? "Review blocked request metadata and confirm no raw content was retained."
        : "No raw content stored. Review redacted preview and metadata if follow-up is needed."
  };
}

function normalizePersistableRequest(input: unknown) {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const conversationId =
    typeof body.conversationId === "string" && body.conversationId.trim() && !["ephemeral", "new-chat"].includes(body.conversationId)
      ? body.conversationId.slice(0, 160)
      : "";

  return {
    conversationId,
    useCase: typeof body.useCase === "string" ? body.useCase.slice(0, 120) : "Accord Chat",
    sensitivity: typeof body.sensitivity === "string" ? body.sensitivity.slice(0, 80) : "Internal"
  };
}

function normalizeExtensionTelemetryPayload(input: unknown): Required<ExtensionTelemetryPayload> {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const eventType = normalizeEventType(body.eventType);
  const action = normalizeTelemetryAction(body.action, eventType);
  const riskScore = clampNumber(body.riskScore, 0, 100);

  return {
    eventType,
    surface: typeof body.surface === "string" && body.surface.trim() ? body.surface.slice(0, 80) : "chatgpt",
    companySlug: typeof body.companySlug === "string" && body.companySlug.trim() ? slugify(body.companySlug).slice(0, 80) : "test-company",
    companyName: typeof body.companyName === "string" && body.companyName.trim() ? body.companyName.slice(0, 120) : "Test Company",
    userLabel: typeof body.userLabel === "string" && body.userLabel.trim() ? body.userLabel.slice(0, 120) : "Test user",
    extensionInstallId:
      typeof body.extensionInstallId === "string" && body.extensionInstallId.trim()
        ? body.extensionInstallId.slice(0, 160)
        : "unknown-install",
    conversationKey: typeof body.conversationKey === "string" ? body.conversationKey.slice(0, 240) : "unknown-conversation",
    action,
    riskScore,
    riskLevel: normalizeRiskLevel(body.riskLevel, riskScore),
    flags: normalizeStringArray(body.flags, 20),
    entityCounts: normalizeNumberRecord(body.entityCounts),
    redactionCount: clampNumber(body.redactionCount, 0, 10000),
    attachmentCount: clampNumber(body.attachmentCount, 0, 1000),
    messageLengthBucket: typeof body.messageLengthBucket === "string" && body.messageLengthBucket.trim() ? body.messageLengthBucket.slice(0, 40) : "unknown",
    metadata: normalizeMetadata(body.metadata, {
      userLabel: typeof body.userLabel === "string" ? body.userLabel.slice(0, 120) : "Test user"
    }),
    occurredAt: typeof body.occurredAt === "string" && !Number.isNaN(Date.parse(body.occurredAt)) ? body.occurredAt : new Date().toISOString(),
    organizationId: typeof body.organizationId === "string" && body.organizationId.trim() ? body.organizationId.slice(0, 120) : typeof body.companySlug === "string" ? slugify(body.companySlug).slice(0, 80) : "test-company",
    employeeUserId: typeof body.employeeUserId === "string" && body.employeeUserId.trim() ? body.employeeUserId.slice(0, 160) : "unknown-employee",
    ruleId: typeof body.ruleId === "string" ? body.ruleId.slice(0, 160) : "",
    ruleKey: typeof body.ruleKey === "string" ? body.ruleKey.slice(0, 160) : "",
    ruleVersion: clampNumber(body.ruleVersion, 0, 100000),
    policyBundleVersion: clampNumber(body.policyBundleVersion, 0, 100000),
    policyAction: typeof body.policyAction === "string" ? body.policyAction.slice(0, 80) : "",
    policySeverity: typeof body.policySeverity === "string" ? body.policySeverity.slice(0, 80) : "",
    aiProvider: typeof body.aiProvider === "string" && body.aiProvider.trim() ? body.aiProvider.slice(0, 80) : "chatgpt",
    destinationType: typeof body.destinationType === "string" && body.destinationType.trim() ? body.destinationType.slice(0, 80) : "personal",
    contentType: typeof body.contentType === "string" && body.contentType.trim() ? body.contentType.slice(0, 80) : "prompt",
    detectedCategories: normalizeStringArray(body.detectedCategories, 40)
  };
}

function normalizeEventType(value: unknown): ExtensionTelemetryEventType {
  const allowed: ExtensionTelemetryEventType[] = [
    "message_sent_to_ai",
    "message_blocked",
    "attachment_governed",
    "attachment_blocked",
    "assistant_response_rehydrated",
    "extension_error"
  ];

  return allowed.includes(value as ExtensionTelemetryEventType) ? (value as ExtensionTelemetryEventType) : "extension_error";
}

function normalizeTelemetryAction(value: unknown, eventType: ExtensionTelemetryEventType): ExtensionTelemetryAction {
  const allowed: ExtensionTelemetryAction[] = [
    "allow",
    "warn",
    "redact",
    "block",
    "clean",
    "redacted",
    "blocked",
    "unsupported",
    "too_large",
    "failed",
    "binary"
  ];
  if (allowed.includes(value as ExtensionTelemetryAction)) return value as ExtensionTelemetryAction;
  if (eventType.includes("blocked")) return "block";
  return "allow";
}

function normalizeRiskLevel(value: unknown, riskScore: number): RiskLevel {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") return value;
  return riskLevel(riskScore);
}

function normalizeStringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.slice(0, 120))
    .slice(0, limit);
}

function normalizeNumberRecord(value: unknown) {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
      .map(([key, count]) => [key.slice(0, 60), Math.max(0, Math.round(count))])
  );
}

function normalizeMetadata(value: unknown, fallback: Record<string, unknown>) {
  if (!isRecord(value)) return fallback;

  const entries = Object.entries(value)
    .filter(([, item]) => ["string", "number", "boolean"].includes(typeof item) || item == null)
    .map(([key, item]) => [key.slice(0, 80), typeof item === "string" ? item.slice(0, 240) : item]);

  return {
    ...fallback,
    ...Object.fromEntries(entries)
  };
}

function categoryFromFlags(flags: ChatRiskFlag[]) {
  if (flags.some((flag) => flag.type === "secret")) return "Secrets/API keys";
  if (flags.some((flag) => flag.type === "prompt_injection")) return "Prompt injection";
  if (flags.some((flag) => flag.type.startsWith("regulated_"))) return "Regulated advice";
  if (flags.some((flag) => ["email", "phone", "address", "account", "possible_name"].includes(flag.type))) return "PII exposure";
  return "Policy screened";
}

function actionTakenFromPolicy(action: string) {
  if (action === "block") return "Blocked";
  if (action === "redact") return "Redacted and logged";
  if (action === "warn") return "Warned and logged";
  return "Allowed and logged";
}

function riskLevel(score: number): RiskLevel {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function providerName(label: string): ProviderName {
  if (label.includes("Anthropic")) return "Anthropic";
  if (label.includes("Gemini")) return "Gemini";
  if (label.includes("OpenAI")) return "OpenAI";
  return "Internal";
}

function titleFromPreview(preview: string) {
  return preview.replace(/\s+/g, " ").slice(0, 96) || "Governed chat";
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function fallbackSnapshot(): AccordDatabaseSnapshot {
  return {
    memory: [],
    recentEvents: [],
    stats: buildDatabaseStats({ metrics: emptyExtensionMetrics() }),
    charts: emptyDashboardChartData(),
    databaseEnabled: false,
    extensionTelemetryEnabled: false,
    extensionMetrics: emptyExtensionMetrics(),
    timeRange: "7d",
    provider: "supabase"
  };
}

function emptyExtensionMetrics(): ExtensionTelemetryMetrics {
  return {
    governedEvents: 0,
    messagesSent: 0,
    messagesRedacted: 0,
    messagesBlocked: 0,
    policyViolations: 0,
    governedUploads: 0,
    protectedIdentifiers: 0,
    activeUsers: 0
  };
}

function emptyDashboardChartData(timeWindow: DashboardTimeWindow = dashboardTimeWindow("7d")): DashboardChartData {
  const start = timeWindow.start || startOfLocalDay(daysAgo(6));
  const end = startOfLocalDay(new Date());
  const bucketCount = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);

  return {
    usageOverTime: Array.from({ length: bucketCount }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      return {
        day: dayLabel(date, bucketCount),
        requests: 0,
        flagged: 0
      };
    }),
    riskDistribution: [
      { name: "Low", value: 0, count: 0, color: "#22c55e" },
      { name: "Medium", value: 0, count: 0, color: "#f59e0b" },
      { name: "High", value: 0, count: 0, color: "#f97316" },
      { name: "Critical", value: 0, count: 0, color: "#ef4444" }
    ],
    providerUsage: [],
    riskCategories: []
  };
}

function hashConversationKey(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingSupabaseRelation(error: unknown) {
  return (
    isRecord(error) &&
    (error.code === "42P01" ||
      error.code === "PGRST205" ||
      /relation .* does not exist/i.test(String(error.message || "")) ||
      /could not find .* table/i.test(String(error.message || "")))
  );
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function dashboardTimeWindow(range: DashboardTimeRange): DashboardTimeWindow {
  if (range === "all") return { range };
  return {
    range,
    start: startOfLocalDay(daysAgo(range === "30d" ? 29 : 6))
  };
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dateKeyFromUnknown(value: unknown) {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateKey(date);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayLabel(date: Date, bucketCount = 7) {
  return new Intl.DateTimeFormat("en-US", bucketCount <= 7 ? { weekday: "short" } : { month: "short", day: "numeric" }).format(date);
}

function firstEventDay(extensionRows: Array<Record<string, unknown>>, governanceRows: Array<Record<string, unknown>>) {
  const dates = [...extensionRows, ...governanceRows]
    .map((row) => (typeof row.created_at === "string" ? new Date(row.created_at) : null))
    .filter((date): date is Date => Boolean(date && !Number.isNaN(date.getTime())));

  if (!dates.length) return null;
  return startOfLocalDay(new Date(Math.min(...dates.map((date) => date.getTime()))));
}

function isPolicyViolationAction(action: string) {
  return ["warn", "redact", "block", "redacted", "blocked"].includes(action);
}

function categoriesFromFlags(value: unknown, eventType: string, action: string) {
  const flags = normalizeStringArray(value, 20);
  const categories = new Set<string>();

  for (const flag of flags) {
    const lower = flag.toLowerCase();
    if (/(personal|person|name|email|phone|address|account|customer id)/.test(lower)) {
      categories.add("PII exposure");
    }
    if (/(regulated|financial|legal|medical|health|hr|employment)/.test(lower)) {
      categories.add("Regulated context");
    }
    if (/(secret|api key|credential|token)/.test(lower)) {
      categories.add("Secrets/API keys");
    }
    if (/(prompt injection|jailbreak|bypass|ignore instructions)/.test(lower)) {
      categories.add("Prompt injection");
    }
  }

  if (eventType.startsWith("attachment")) {
    categories.add("Attachment governance");
  }
  if (action === "block" || action === "blocked" || eventType.includes("blocked")) {
    categories.add("Blocked request");
  }

  return categories.size ? Array.from(categories) : ["Policy screened"];
}

function extensionCategory(eventType: string, action: string) {
  if (eventType === "message_blocked") return "Message blocked";
  if (eventType === "attachment_blocked") return "Attachment blocked";
  if (eventType === "attachment_governed") return "Governed upload";
  if (action === "redact" || action === "redacted") return "PII redaction";
  if (action === "warn") return "Policy warning";
  return "Extension telemetry";
}

function extensionActionTaken(eventType: string, action: string) {
  if (eventType === "message_sent_to_ai") return action === "redact" ? "Redacted and sent" : "Sent through ChatGPT";
  if (eventType === "message_blocked") return "Blocked before AI";
  if (eventType === "attachment_governed") return "Protected copy uploaded";
  if (eventType === "attachment_blocked") return "Original upload blocked";
  if (eventType === "assistant_response_rehydrated") return "Response rehydrated locally";
  return "Logged";
}

function extensionPreview(eventType: string, metadata: Record<string, unknown>) {
  const bucket = typeof metadata.messageLengthBucket === "string" ? metadata.messageLengthBucket : "content";
  if (eventType.startsWith("attachment")) return "Extension governed an attachment. Raw file content was not stored.";
  if (eventType === "message_sent_to_ai") return `Extension allowed a ${bucket} message after local governance.`;
  if (eventType === "message_blocked") return `Extension blocked a ${bucket} message before AI submission.`;
  return "Extension event logged without raw content.";
}

function extensionPolicyTriggered(eventType: string, action: string) {
  if (eventType === "message_blocked" || action === "block" || action === "blocked") return "Accord Guard blocked submission before external AI routing.";
  if (action === "redact" || action === "redacted") return "Accord Guard redacted identifiers before external AI routing.";
  if (action === "warn") return "Accord Guard detected policy-sensitive context.";
  return "Extension telemetry captured metadata only.";
}

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, 3000) : "";
}

function clampString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readFormList(formData: FormData, key: string) {
  const value = readFormString(formData, key);
  if (!value) return [];

  return value
    .split(/[\n,]/)
    .map((item) => slugify(item).replace(/-/g, "_"))
    .filter(Boolean)
    .slice(0, 40);
}

function normalizePolicyAction(value: unknown): PolicyRuleAction {
  const allowed: PolicyRuleAction[] = ["allow", "transform", "warn", "require_approval", "block"];
  return allowed.includes(value as PolicyRuleAction) ? (value as PolicyRuleAction) : "warn";
}

function normalizeDestinationType(value: unknown): PolicyDestinationType {
  const allowed: PolicyDestinationType[] = ["any", "approved", "enterprise", "personal", "unapproved"];
  return allowed.includes(value as PolicyDestinationType) ? (value as PolicyDestinationType) : "personal";
}

function normalizePolicyRuleStatus(value: unknown): PolicyRuleStatus {
  if (value === "approved" || value === "rejected" || value === "archived") return value;
  return "draft";
}

function checksumJson(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function titleFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}

function eventSortTime(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
