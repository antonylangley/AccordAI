import { NextResponse, type NextRequest } from "next/server";
import { authErrorCodeForMessage } from "@/lib/auth/auth-errors";
import { ensureUserOrganization } from "@/lib/auth/organization";
import { createSupabaseRouteAuthClient } from "@/lib/auth/supabase-route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnTo = normalizeReturnTo(requestUrl.searchParams.get("returnTo"));
  const routeAuth = createSupabaseRouteAuthClient(request);

  if (!routeAuth) {
    return NextResponse.redirect(new URL("/login?error=supabase-not-configured", requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth-callback-failed", requestUrl.origin));
  }

  const { error } = await routeAuth.supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const errorCode = authErrorCodeForMessage(error.message);
    console.info("[Accord auth] OAuth callback failed", { reasonCategory: errorCode });
    return routeAuth.applyAuthCookies(NextResponse.redirect(new URL(`/login?error=${errorCode}`, requestUrl.origin)));
  }

  const {
    data: { user }
  } = await routeAuth.supabase.auth.getUser();

  if (user) {
    await ensureUserOrganization(user);
  }

  return routeAuth.applyAuthCookies(NextResponse.redirect(new URL(returnTo, requestUrl.origin)));
}

function normalizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value.slice(0, 120);
}
