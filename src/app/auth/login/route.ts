import { NextResponse } from "next/server";
import type { AuthProvider } from "@/lib/auth/supabase-server";
import { appOriginFromRequest, createSupabaseServerAuthClient } from "@/lib/auth/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createSupabaseServerAuthClient();
  if (!supabase) return NextResponse.redirect(new URL("/login?error=supabase-not-configured", request.url));

  const url = new URL(request.url);
  const provider = normalizeProvider(url.searchParams.get("provider"));
  const returnTo = normalizeReturnTo(url.searchParams.get("returnTo"));
  const redirectTo = new URL(`/auth/callback?returnTo=${encodeURIComponent(returnTo)}`, appOriginFromRequest(request));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo.toString()
    }
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error?.message || "oauth-start-failed")}`, request.url));
  }

  return NextResponse.redirect(data.url);
}

function normalizeProvider(value: string | null): AuthProvider {
  return value === "github" ? "github" : "google";
}

function normalizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value.slice(0, 120);
}
