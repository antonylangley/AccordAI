import { NextResponse, type NextRequest } from "next/server";
import type { AuthProvider } from "@/lib/auth/supabase-server";
import { appOriginFromRequest } from "@/lib/auth/supabase-server";
import { authErrorCodeForMessage } from "@/lib/auth/auth-errors";
import { createSupabaseRouteAuthClient } from "@/lib/auth/supabase-route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const routeAuth = createSupabaseRouteAuthClient(request);
  if (!routeAuth) return NextResponse.redirect(new URL("/login?error=supabase-not-configured", request.url));

  const url = new URL(request.url);
  const provider = normalizeProvider(url.searchParams.get("provider"));
  const returnTo = normalizeReturnTo(url.searchParams.get("returnTo"));
  const redirectTo = new URL(`/auth/callback?returnTo=${encodeURIComponent(returnTo)}`, appOriginFromRequest(request));

  const { data, error } = await routeAuth.supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo.toString()
    }
  });

  if (error || !data.url) {
    const code = authErrorCodeForMessage(error?.message || "oauth-start-failed");
    return routeAuth.applyAuthCookies(NextResponse.redirect(new URL(`/login?error=${code}`, request.url)));
  }

  return routeAuth.applyAuthCookies(NextResponse.redirect(data.url));
}

function normalizeProvider(value: string | null): AuthProvider {
  return value === "github" ? "github" : "google";
}

function normalizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value.slice(0, 120);
}
