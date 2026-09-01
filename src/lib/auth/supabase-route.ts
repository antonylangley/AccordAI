import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthConfig } from "./supabase-server";

type PendingAuthCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export type SupabaseRouteAuth = {
  supabase: SupabaseClient;
  applyAuthCookies: (response: NextResponse) => NextResponse;
};

export function createSupabaseRouteAuthClient(request: NextRequest): SupabaseRouteAuth | null {
  const config = getSupabaseAuthConfig();
  if (!config) return null;

  const pendingCookies: PendingAuthCookie[] = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient(config.supabaseUrl, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        pendingCookies.push(...cookiesToSet);
        Object.assign(pendingHeaders, headers);
      }
    }
  });

  return {
    supabase,
    applyAuthCookies(response) {
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options);
      }
      for (const [name, value] of Object.entries(pendingHeaders)) {
        response.headers.set(name, value);
      }
      if (pendingCookies.length && !response.headers.has("Cache-Control")) {
        response.headers.set("Cache-Control", "private, no-store");
      }
      return response;
    }
  };
}
