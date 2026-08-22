import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getGuardPublicConfig } from "./config";
import { chromeExtensionAuthStorage } from "./storage";

let authClient: SupabaseClient | null = null;

export async function getGuardAuthClient() {
  if (authClient) return authClient;
  const config = await getGuardPublicConfig();
  authClient = createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      storage: chromeExtensionAuthStorage,
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
  return authClient;
}

export function resetGuardAuthClientForTests() {
  authClient = null;
}
