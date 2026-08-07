import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/auth/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createSupabaseServerAuthClient();
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}
