import { describe, expect, test } from "vitest";
import { trustedExtensionOAuthUrl } from "../../../src/lib/auth/extension-oauth";
import { buildGuardLoginUrl } from "./oauth-url";

describe("Guard website OAuth handoff", () => {
  test("routes the extension-owned PKCE flow through the existing Accord login page", () => {
    const oauthUrl =
      "https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fabcdefghijklmnopabcdefghijklmnop.chromiumapp.org%2Fauth%2Fcallback";
    const result = new URL(
      buildGuardLoginUrl({
        apiBaseUrl: "https://www.accordgovernance.com",
        provider: "google",
        oauthUrl
      })
    );

    expect(result.origin).toBe("https://www.accordgovernance.com");
    expect(result.pathname).toBe("/login");
    expect(result.searchParams.get("extensionProvider")).toBe("google");
    expect(result.searchParams.get("extensionOAuthUrl")).toBe(oauthUrl);
  });

  test("accepts only the configured Supabase OAuth endpoint with an extension callback", () => {
    const supabaseUrl = "https://project.supabase.co";
    const oauthUrl = new URL("/auth/v1/authorize", supabaseUrl);
    oauthUrl.searchParams.set("provider", "google");
    oauthUrl.searchParams.set(
      "redirect_to",
      "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/callback"
    );

    expect(
      trustedExtensionOAuthUrl({
        candidate: oauthUrl.toString(),
        provider: "google",
        supabaseUrl
      })
    ).toBe(oauthUrl.toString());

    oauthUrl.hostname = "attacker.example";
    expect(
      trustedExtensionOAuthUrl({
        candidate: oauthUrl.toString(),
        provider: "google",
        supabaseUrl
      })
    ).toBeNull();
  });

  test("rejects provider mismatches and non-extension callbacks", () => {
    const supabaseUrl = "https://project.supabase.co";
    const oauthUrl = new URL("/auth/v1/authorize", supabaseUrl);
    oauthUrl.searchParams.set("provider", "github");
    oauthUrl.searchParams.set("redirect_to", "https://www.accordgovernance.com/auth/callback");

    expect(
      trustedExtensionOAuthUrl({
        candidate: oauthUrl.toString(),
        provider: "google",
        supabaseUrl
      })
    ).toBeNull();
  });
});
