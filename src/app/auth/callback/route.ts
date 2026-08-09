import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/auth/supabase-server";
import { ensureUserOrganization } from "@/lib/auth/organization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnTo = normalizeReturnTo(requestUrl.searchParams.get("returnTo"));
  const supabase = createSupabaseServerAuthClient();

  if (!supabase || !code) {
    return NextResponse.redirect(new URL("/login?error=auth-callback-failed", requestUrl.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    await ensureUserOrganization(user);
  }

  return NextResponse.redirect(new URL(returnTo, requestUrl.origin));
}

function normalizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value.slice(0, 120);
}
