import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clearGuardOAuthAttempt,
  clearSupabasePkceVerifier,
  GUARD_OAUTH_ATTEMPTS_KEY,
  rememberGuardOAuthAttempt,
  restoreGuardOAuthAttempt
} from "./oauth-attempts";

const store: Record<string, unknown> = {};
const verifierKey = "sb-test-auth-token-code-verifier";
const prefixedVerifierKey = `accordGuardAuth:${verifierKey}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
  for (const key of Object.keys(store)) delete store[key];
  globalThis.chrome = {
    storage: {
      local: {
        get(keys: string | string[] | null, callback: (items: Record<string, unknown>) => void) {
          if (keys === null) return callback({ ...store });
          const keyList = Array.isArray(keys) ? keys : [keys];
          callback(Object.fromEntries(keyList.map((key) => [key, store[key]])));
        },
        set(items: Record<string, unknown>, callback?: () => void) {
          Object.assign(store, items);
          callback?.();
        },
        remove(keys: string | string[], callback?: () => void) {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
          callback?.();
        }
      }
    }
  } as unknown as typeof chrome;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Guard OAuth attempts", () => {
  test("stores and restores a PKCE verifier by OAuth state", async () => {
    store[prefixedVerifierKey] = "verifier_1";

    await rememberGuardOAuthAttempt({
      state: "state_1",
      provider: "google",
      redirectUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/callback",
      client: authClient()
    });
    store[prefixedVerifierKey] = "overwritten";

    const attempt = await restoreGuardOAuthAttempt({
      state: "state_1",
      provider: "google",
      redirectUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/callback",
      client: authClient()
    });

    expect(attempt).toMatchObject({ provider: "google", codeVerifier: "verifier_1" });
    expect(store[prefixedVerifierKey]).toBe("verifier_1");
  });

  test("rejects stale attempts and does not restore their verifier", async () => {
    store[GUARD_OAUTH_ATTEMPTS_KEY] = {
      stale: {
        provider: "google",
        redirectUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/callback",
        createdAt: "2026-08-31T23:49:00.000Z",
        codeVerifier: "stale_verifier",
        codeVerifierStorageKey: verifierKey
      }
    };
    store[prefixedVerifierKey] = "current_verifier";

    await expect(
      restoreGuardOAuthAttempt({
        state: "stale",
        provider: "google",
        redirectUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/callback",
        client: authClient()
      })
    ).resolves.toBeNull();
    expect(store[prefixedVerifierKey]).toBe("current_verifier");
    expect(store[GUARD_OAUTH_ATTEMPTS_KEY]).toEqual({});
  });

  test("does not mix attempts across providers or redirect URLs", async () => {
    store[prefixedVerifierKey] = "verifier_1";
    await rememberGuardOAuthAttempt({
      state: "state_1",
      provider: "google",
      redirectUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/callback",
      client: authClient()
    });

    await expect(
      restoreGuardOAuthAttempt({
        state: "state_1",
        provider: "github",
        redirectUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/callback",
        client: authClient()
      })
    ).resolves.toBeNull();
    await expect(
      restoreGuardOAuthAttempt({
        state: "state_1",
        provider: "google",
        redirectUrl: "https://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.chromiumapp.org/auth/callback",
        client: authClient()
      })
    ).resolves.toBeNull();
  });

  test("clears only the completed attempt and Supabase PKCE verifier", async () => {
    store[prefixedVerifierKey] = "verifier_1";
    await rememberGuardOAuthAttempt({
      state: "state_1",
      provider: "google",
      redirectUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/callback",
      client: authClient()
    });
    store[prefixedVerifierKey] = "verifier_2";
    await rememberGuardOAuthAttempt({
      state: "state_2",
      provider: "google",
      redirectUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/callback",
      client: authClient()
    });

    await clearGuardOAuthAttempt("state_1", authClient());

    expect(store[prefixedVerifierKey]).toBeUndefined();
    expect(store[GUARD_OAUTH_ATTEMPTS_KEY]).toHaveProperty("state_2");
    expect(store[GUARD_OAUTH_ATTEMPTS_KEY]).not.toHaveProperty("state_1");
  });

  test("clears Supabase's global PKCE verifier slot before a new attempt starts", async () => {
    store[prefixedVerifierKey] = "stale_verifier";

    await clearSupabasePkceVerifier(authClient());

    expect(store[prefixedVerifierKey]).toBeUndefined();
  });
});

function authClient() {
  return { auth: { storageKey: "sb-test-auth-token" } } as unknown as SupabaseClient;
}
