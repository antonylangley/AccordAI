import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Provider } from "@supabase/supabase-js";

export type AuthProvider = Extract<Provider, "google" | "github">;

export function getSupabaseAuthConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  if (!supabaseUrl || !publishableKey) return null;

  return {
    supabaseUrl,
    publishableKey
  };
}

export function createSupabaseServerAuthClient() {
  const config = getSupabaseAuthConfig();
  if (!config) return null;

  const cookieStore = cookies();

  return createServerClient(config.supabaseUrl, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        const writableCookieStore = cookieStore as unknown as {
          set: (name: string, value: string, options?: unknown) => void;
        };

        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            writableCookieStore.set(name, value, options);
          });
        } catch {
          // Server components can read cookies but cannot always write them.
        }
      }
    }
  });
}

export function appOriginFromRequest(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  return new URL(request.url).origin;
}
