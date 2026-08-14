import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccordDatabaseSnapshot, getSupabaseServerClient } from "@/lib/db/accord-store";

export const dynamic = "force-dynamic";

const checkedTables = [
  "accord_workspace_memory",
  "accord_companies",
  "accord_extension_users",
  "accord_extension_events",
  "accord_policy_rules",
  "accord_policy_bundles"
] as const;

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const supabase = getSupabaseServerClient();

  const [snapshot, tables] = await Promise.all([
    getAccordDatabaseSnapshot("test-company"),
    supabase ? Promise.all(checkedTables.map((table) => checkTable(supabase, table))) : Promise.resolve([])
  ]);

  return NextResponse.json(
    {
      env: {
        hasSupabaseUrl: Boolean(supabaseUrl),
        supabaseProjectRef: getSupabaseProjectRef(supabaseUrl),
        hasPublicSupabaseUrl: Boolean(publicSupabaseUrl),
        publicSupabaseProjectRef: getSupabaseProjectRef(publicSupabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        serviceRoleKeyShape: describeKeyShape(serviceRoleKey),
        serviceRoleJwtRole: decodeJwtRole(serviceRoleKey),
        hasPublicKey: Boolean(publicKey),
        publicKeyShape: describeKeyShape(publicKey)
      },
      clientCreated: Boolean(supabase),
      dashboardSnapshot: {
        databaseEnabled: snapshot.databaseEnabled,
        extensionTelemetryEnabled: snapshot.extensionTelemetryEnabled,
        provider: snapshot.provider,
        recentEvents: snapshot.recentEvents.length,
        memoryItems: snapshot.memory.length,
        totalRequests: snapshot.extensionMetrics.messagesSent,
        redactedRequests: snapshot.extensionMetrics.messagesRedacted,
        blockedMessages: snapshot.extensionMetrics.messagesBlocked,
        policyViolations: snapshot.extensionMetrics.policyViolations,
        activeUsers: snapshot.extensionMetrics.activeUsers
      },
      tables
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

async function checkTable(supabase: SupabaseClient, table: (typeof checkedTables)[number]) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });

  return {
    table,
    ok: !error,
    count: count ?? null,
    error: error
      ? {
          code: error.code,
          message: error.message,
          details: error.details || null,
          hint: error.hint || null
        }
      : null
  };
}

function getSupabaseProjectRef(value: string) {
  try {
    const host = new URL(value).hostname;
    return host.endsWith(".supabase.co") ? host.replace(".supabase.co", "") : host;
  } catch {
    return value ? "invalid-url" : null;
  }
}

function describeKeyShape(value: string) {
  if (!value) return "missing";
  if (value.startsWith("sb_secret_")) return "supabase-secret";
  if (value.startsWith("sb_publishable_")) return "supabase-publishable";
  if (value.split(".").length === 3) return "jwt";
  return "unknown";
}

function decodeJwtRole(value: string) {
  try {
    const [, payload] = value.split(".");
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { role?: unknown };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}
