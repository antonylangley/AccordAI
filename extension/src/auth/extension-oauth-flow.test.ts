import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { connectGuardAccount, disconnectGuardAccount, getGuardAuthSnapshot } from "./session";

const mocks = vi.hoisted(() => ({
  apiBaseUrl: vi.fn(),
  getClient: vi.fn(),
  client: null as any,
  launchError: null as string | null,
  callbackMode: "success" as "success" | "state_mismatch",
  writeVerifier: true,
  launchedUrls: [] as string[]
}));

vi.mock("./client", () => ({
  getGuardAuthClient: mocks.getClient
}));

vi.mock("./config", () => ({
  getApiBaseUrl: mocks.apiBaseUrl
}));

const store: Record<string, unknown> = {};
const redirectUrl = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/callback";
const verifierStorageKey = "accordGuardAuth:sb-test-auth-token-code-verifier";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  for (const key of Object.keys(store)) delete store[key];
  mocks.launchError = null;
  mocks.callbackMode = "success";
  mocks.writeVerifier = true;
  mocks.launchedUrls = [];
  mocks.apiBaseUrl.mockResolvedValue("https://www.accordgovernance.com");

  const auth = {
    storageKey: "sb-test-auth-token",
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    signInWithOAuth: vi.fn(async (credentials: any) => {
      const state = credentials.options?.queryParams?.state;
      if (mocks.writeVerifier) store[verifierStorageKey] = `verifier_${state}`;
      return { data: { url: authorizeUrl(state, credentials.options?.redirectTo) }, error: null };
    }),
    exchangeCodeForSession: vi.fn(async () => ({ data: { session: session() }, error: null })),
    refreshSession: vi.fn(),
    signOut: vi.fn(async () => ({ error: null }))
  };
  mocks.client = { auth };
  mocks.getClient.mockResolvedValue(mocks.client);

  globalThis.chrome = {
    runtime: {},
    identity: {
      getRedirectURL: vi.fn(() => redirectUrl),
      launchWebAuthFlow: vi.fn(({ url }: { url: string }, callback: (callbackUrl?: string) => void) => {
        mocks.launchedUrls.push(url);
        if (mocks.launchError) {
          (chrome.runtime as { lastError?: { message: string } }).lastError = { message: mocks.launchError };
          callback();
          delete (chrome.runtime as { lastError?: { message: string } }).lastError;
          return;
        }
        const state = new URL(url).searchParams.get("state");
        const returnedState = mocks.callbackMode === "state_mismatch" ? "wrong_state" : state;
        callback(`${redirectUrl}?code=fresh_code&state=${returnedState}`);
      })
    },
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

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => bootstrapBody()
    }))
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Guard extension OAuth flow", () => {
  test("fresh Google login launches Supabase directly, exchanges in extension storage, and bootstraps org policy", async () => {
    const result = await connectGuardAccount("google");

    expect(result).toMatchObject({
      status: "authenticated",
      organization: { id: "org_1" },
      membership: { role: "owner" },
      policy: { state: "syncing", sourceType: "organization" }
    });
    expect(mocks.client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: { state: expect.any(String) }
      }
    });
    expect(chrome.identity.getRedirectURL).toHaveBeenCalledWith("auth/callback");
    expect(mocks.launchedUrls).toHaveLength(1);
    expect(mocks.launchedUrls[0]).toContain("https://project.supabase.co/auth/v1/authorize");
    expect(mocks.launchedUrls[0]).not.toContain("accordgovernance.com/login");
    expect(mocks.client.auth.exchangeCodeForSession).toHaveBeenCalledWith("fresh_code");
    expect(fetch).toHaveBeenCalledWith("https://www.accordgovernance.com/api/guard/bootstrap", {
      cache: "no-store",
      headers: { Authorization: "Bearer access_token_1" }
    });
  });

  test("missing PKCE verifier returns a recoverable sign-in session error", async () => {
    mocks.writeVerifier = false;

    const result = await connectGuardAccount("google");

    expect(result).toMatchObject({
      status: "error",
      code: "oauth_session_expired",
      message: "Sign-in session expired. Please try signing in again.",
      recoverable: true
    });
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    expect(mocks.client.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  test("OAuth state mismatch is rejected before code exchange", async () => {
    mocks.callbackMode = "state_mismatch";

    const result = await connectGuardAccount("google");

    expect(result).toMatchObject({
      status: "error",
      code: "oauth_session_expired"
    });
    expect(mocks.client.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  test("cancelled OAuth recovers and the next login attempt can succeed", async () => {
    mocks.launchError = "OAuth window closed.";
    await expect(connectGuardAccount("google")).resolves.toMatchObject({
      status: "error",
      code: "oauth_cancelled"
    });

    mocks.launchError = null;
    await expect(connectGuardAccount("google")).resolves.toMatchObject({
      status: "authenticated",
      membership: { role: "owner" }
    });
    expect(mocks.client.auth.signInWithOAuth).toHaveBeenCalledTimes(2);
  });

  test("existing valid sessions bootstrap without starting OAuth", async () => {
    mocks.client.auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });

    const result = await getGuardAuthSnapshot({ force: true });

    expect(result).toMatchObject({
      status: "authenticated",
      organization: { id: "org_1" }
    });
    expect(mocks.client.auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  test("sign out clears auth state and a later sign-in starts a fresh auth attempt", async () => {
    await expect(connectGuardAccount("google")).resolves.toMatchObject({ status: "authenticated" });

    await expect(disconnectGuardAccount()).resolves.toMatchObject({ status: "signed_out" });
    expect(Object.keys(store).filter((key) => key.startsWith("accordGuardAuth:"))).toEqual([]);

    await expect(connectGuardAccount("google")).resolves.toMatchObject({ status: "authenticated" });
    expect(mocks.client.auth.signInWithOAuth).toHaveBeenCalledTimes(2);
  });
});

function authorizeUrl(state: string, redirectTo: string) {
  const url = new URL("https://project.supabase.co/auth/v1/authorize");
  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", redirectTo);
  url.searchParams.set("code_challenge", "challenge");
  url.searchParams.set("code_challenge_method", "s256");
  url.searchParams.set("state", state);
  return url.toString();
}

function session() {
  return {
    access_token: "access_token_1",
    refresh_token: "refresh_token_1",
    expires_in: 3600,
    expires_at: 1770000000,
    token_type: "bearer",
    user: {
      id: "user_1",
      email: "owner@example.com",
      user_metadata: { full_name: "Owner User" },
      app_metadata: { provider: "google" }
    }
  };
}

function bootstrapBody() {
  return {
    user: { id: "user_1", email: "owner@example.com", displayName: "Owner User", provider: "google" },
    organization: { id: "org_1", slug: "test-company", name: "Test Company" },
    membership: { id: "membership_1", role: "owner", status: "active" },
    policy: {
      sourceType: "organization",
      bundleId: "bundle_1",
      version: 12,
      activeRuleCount: 3,
      lastPublishedAt: "2026-09-01T00:00:00.000Z",
      fallbackActive: false,
      organizationSpecificRulesAvailable: true
    }
  };
}
