import type { GuardAuthProvider } from "./types";

export function buildGuardLoginUrl({
  apiBaseUrl,
  provider,
  oauthUrl
}: {
  apiBaseUrl: string;
  provider: GuardAuthProvider;
  oauthUrl: string;
}) {
  const loginUrl = new URL("/login", apiBaseUrl);
  loginUrl.searchParams.set("extensionProvider", provider);
  loginUrl.searchParams.set("extensionOAuthUrl", oauthUrl);
  return loginUrl.toString();
}
