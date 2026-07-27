import "server-only";

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

export type AccordDatabaseSnapshot = {
  memory: WorkspaceMemoryItem[];
  recentEvents: GovernanceEvent[];
  stats: Stat[];
  databaseEnabled: boolean;
  provider: "supabase";
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

export async function getAccordDatabaseSnapshot(): Promise<AccordDatabaseSnapshot> {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return fallbackSnapshot();

    await seedWorkspaceMemory(supabase);
    const memory = await getWorkspaceMemoryRows(supabase);
    const recentEvents = await getRecentGovernanceEventRows(supabase, 8);
    const stats = await buildDatabaseStats(supabase);

    return {
      memory,
      recentEvents,
      stats,
      databaseEnabled: true,
      provider: "supabase"
    };
  } catch {
    return fallbackSnapshot();
  }
}

export async function persistChatGatewayRun(input: unknown, response: ChatGatewayResponse) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    await seedWorkspaceMemory(supabase);
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

function getSupabaseServerClient() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
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

async function buildDatabaseStats(supabase: SupabaseClient): Promise<Stat[]> {
  const [totalResult, highRiskResult, blockedResult] = await Promise.all([
    supabase.from("accord_chat_messages").select("id", { count: "exact", head: true }).eq("role", "user"),
    supabase.from("accord_governance_events").select("id", { count: "exact", head: true }).gte("risk_score", 60),
    supabase.from("accord_governance_events").select("id", { count: "exact", head: true }).eq("action_taken", "Blocked")
  ]);
  if (totalResult.error) throw totalResult.error;
  if (highRiskResult.error) throw highRiskResult.error;
  if (blockedResult.error) throw blockedResult.error;

  const total = totalResult.count || 0;
  const highRisk = highRiskResult.count || 0;
  const blocked = blockedResult.count || 0;

  return dashboardStats.map((stat) => {
    if (stat.label === "Total AI requests") {
      return { ...stat, value: formatNumber(total), detail: "Persisted governed chat requests" };
    }
    if (stat.label === "High-risk events") {
      return { ...stat, value: formatNumber(highRisk), detail: "Risk score 60+" };
    }
    if (stat.label === "Blocked requests") {
      return { ...stat, value: formatNumber(blocked), detail: "Provider call prevented" };
    }
    return stat;
  });
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
    stats: dashboardStats,
    databaseEnabled: false,
    provider: "supabase"
  };
}
