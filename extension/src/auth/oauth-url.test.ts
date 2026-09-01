import { describe, expect, test } from "vitest";
import { trustedExtensionOAuthUrl } from "../../../src/lib/auth/extension-oauth";

describe("Guard website OAuth handoff validation", () => {
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
