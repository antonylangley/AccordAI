import { NextResponse } from "next/server";
import { getSupabaseAuthConfig } from "@/lib/auth/supabase-server";
import { guardCorsHeaders } from "@/lib/auth/guard-api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: guardCorsHeaders() });
}

export function GET() {
  const config = getSupabaseAuthConfig();
  if (!config) return NextResponse.json({ error: "Accord authentication is not configured." }, { status: 503, headers: guardCorsHeaders() });
  return NextResponse.json(config, { headers: guardCorsHeaders() });
}
