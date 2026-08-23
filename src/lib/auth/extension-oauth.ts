import type { AuthProvider } from "./supabase-server";

const CHROME_EXTENSION_CALLBACK_HOST = /^[a-p]{32}\.chromiumapp\.org$/;

export function trustedExtensionOAuthUrl({
  candidate,
  provider,
  supabaseUrl
}: {
  candidate: string | undefined;
  provider: AuthProvider;
  supabaseUrl: string | undefined;
}) {
  if (!candidate || !supabaseUrl) return null;

  try {
    const oauthUrl = new URL(candidate);
    const configuredSupabaseUrl = new URL(supabaseUrl);
    if (oauthUrl.origin !== configuredSupabaseUrl.origin || oauthUrl.pathname !== "/auth/v1/authorize") return null;
    if (oauthUrl.searchParams.get("provider") !== provider) return null;

    const redirectValue = oauthUrl.searchParams.get("redirect_to");
    if (!redirectValue) return null;
    const redirectUrl = new URL(redirectValue);
    const validCallback =
      redirectUrl.protocol === "https:" &&
      CHROME_EXTENSION_CALLBACK_HOST.test(redirectUrl.hostname) &&
      redirectUrl.pathname === "/auth/callback" &&
      !redirectUrl.username &&
      !redirectUrl.password &&
      !redirectUrl.port &&
      !redirectUrl.search &&
      !redirectUrl.hash;
    if (!validCallback) return null;

    return oauthUrl.toString();
  } catch {
    return null;
  }
}
