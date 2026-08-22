import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import { getSupabaseAuthConfig } from "@/lib/auth/supabase-server";
import { getSupabaseServerClient } from "@/lib/db/accord-store";
import type { AccordRole } from "@/lib/auth/permissions";

export type GuardRequestIdentity = {
  user: User;
  organization: { id: string; slug: string; name: string } | null;
  membership: { id: string; role: AccordRole; status: "active" } | null;
};

export async function authenticateGuardRequest(request: Request): Promise<GuardRequestIdentity | null> {
  const token = bearerToken(request.headers.get("authorization"));
  const config = getSupabaseAuthConfig();
  const service = getSupabaseServerClient();
  if (!token || !config || !service) return null;

  const auth = createClient(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) return null;

  const membershipResult = await service
    .from("accord_company_members")
    .select("id,company_slug,role,status")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const member = membershipResult.data;
  if (!member || typeof member.company_slug !== "string") {
    return { user: data.user, organization: null, membership: null };
  }

  const companyResult = await service
    .from("accord_companies")
    .select("id,slug,name")
    .eq("slug", member.company_slug)
    .maybeSingle();
  const company = companyResult.data;
  if (!company || typeof company.id !== "string" || typeof company.slug !== "string") {
    return { user: data.user, organization: null, membership: null };
  }

  return {
    user: data.user,
    organization: {
      id: company.id,
      slug: company.slug,
      name: typeof company.name === "string" ? company.name : company.slug
    },
    membership: {
      id: String(member.id),
      role: normalizeRole(member.role),
      status: "active"
    }
  };
}

export function guardCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Cache-Control": "no-store"
  };
}

function bearerToken(value: string | null) {
  const match = value?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}

function normalizeRole(value: unknown): AccordRole {
  return value === "owner" || value === "admin" || value === "viewer" ? value : "member";
}
