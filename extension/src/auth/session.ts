import type { Session, User } from "@supabase/supabase-js";
import { getApiBaseUrl } from "./config";
import { getGuardAuthClient } from "./client";
import {
  clearGuardAuthStorage,
  GUARD_PUBLIC_ACCOUNT_KEY,
  readStoredValue,
  removeStoredValue,
  writeStoredValue
} from "./storage";
import type {
  GuardAuthProvider,
  GuardAuthSnapshot,
  GuardBootstrapResponse,
  GuardPolicySync
} from "./types";

const now = () => new Date().toISOString();
let connectionPromise: Promise<GuardAuthSnapshot> | null = null;

export function signedOutSnapshot(): GuardAuthSnapshot {
  return { status: "signed_out", localProtection: true, updatedAt: now() };
}

export async function getGuardAuthSnapshot({ force = false }: { force?: boolean } = {}): Promise<GuardAuthSnapshot> {
  if (connectionPromise) return connectionPromise;
  const cached = await readPublicSnapshot();
  if (!force && cached) return cached;

  try {
    const client = await getGuardAuthClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
      const result = signedOutSnapshot();
      await persistPublicSnapshot(result);
      return result;
    }
    return bootstrapSession(data.session, cached);
  } catch (error) {
    return offlineOrError(cached, error);
  }
}

export function connectGuardAccount(provider: GuardAuthProvider): Promise<GuardAuthSnapshot> {
  if (connectionPromise) return connectionPromise;
  connectionPromise = runOAuth(provider).finally(() => {
    connectionPromise = null;
  });
  return connectionPromise;
}

export async function disconnectGuardAccount() {
  try {
    const client = await getGuardAuthClient();
    await client.auth.signOut({ scope: "local" });
  } finally {
    await clearGuardAuthStorage();
  }
  return signedOutSnapshot();
}

export async function getGuardAccessToken() {
  try {
    const client = await getGuardAuthClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}

export async function markGuardPolicySync(policy: GuardPolicySync) {
  const snapshot = await readPublicSnapshot();
  if (snapshot?.status !== "authenticated") return;
  await persistPublicSnapshot({ ...snapshot, policy, updatedAt: now() });
}

async function runOAuth(provider: GuardAuthProvider) {
  const connecting: GuardAuthSnapshot = { status: "connecting", localProtection: true, updatedAt: now() };
  await persistPublicSnapshot(connecting);
  try {
    const identity = globalThis.chrome?.identity;
    if (!identity?.launchWebAuthFlow) throw new Error("Chrome identity is unavailable.");
    const client = await getGuardAuthClient();
    const redirectTo = identity.getRedirectURL("auth/callback");
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true }
    });
    if (error || !data.url) throw error || new Error("Accord could not start OAuth.");
    const callbackUrl = await launchAuthFlow(data.url);
    const code = new URL(callbackUrl).searchParams.get("code");
    if (!code) throw new Error("The OAuth provider did not return an authorization code.");
    const exchange = await client.auth.exchangeCodeForSession(code);
    if (exchange.error || !exchange.data.session) throw exchange.error || new Error("Accord could not create a session.");
    return bootstrapSession(exchange.data.session, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accord account connection failed.";
    const cancelled = /cancel|closed|window/i.test(message);
    const result: GuardAuthSnapshot = {
      status: "error",
      localProtection: true,
      updatedAt: now(),
      code: cancelled ? "oauth_cancelled" : "oauth_failed",
      message: cancelled ? "Account connection was cancelled." : "Accord could not connect your account. Please try again.",
      recoverable: true
    };
    await persistPublicSnapshot(result);
    return result;
  }
}

function launchAuthFlow(url: string) {
  return new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (callbackUrl) => {
      const runtimeError = chrome.runtime.lastError?.message;
      if (runtimeError || !callbackUrl) reject(new Error(runtimeError || "OAuth window closed."));
      else resolve(callbackUrl);
    });
  });
}

async function bootstrapSession(session: Session, cached: GuardAuthSnapshot | null, allowRefresh = true) {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/api/guard/bootstrap`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (response.status === 401 && allowRefresh) {
      const client = await getGuardAuthClient();
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session) throw new Error("session_expired");
      return bootstrapSession(refreshed.data.session, cached, false);
    }
    if (response.status === 401) throw new Error("session_expired");
    if (!response.ok) throw new Error(`bootstrap_${response.status}`);
    const body = (await response.json()) as GuardBootstrapResponse;
    const policy: GuardPolicySync = body.policy
      ? { ...body.policy, state: "syncing" }
      : { state: "none" };
    const result: GuardAuthSnapshot = {
      status: "authenticated",
      localProtection: true,
      updatedAt: now(),
      user: body.user,
      organization: body.organization,
      membership: body.membership,
      policy
    };
    await persistPublicSnapshot(result);
    return result;
  } catch (error) {
    return offlineOrError(cached ?? snapshotFromSessionUser(session.user), error);
  }
}

function snapshotFromSessionUser(user: User): GuardAuthSnapshot {
  return {
    status: "authenticated",
    localProtection: true,
    updatedAt: now(),
    user: {
      id: user.id,
      email: user.email || "",
      displayName: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Accord user"),
      avatarUrl: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : undefined
    },
    organization: null,
    membership: null,
    policy: { state: "offline" }
  };
}

function offlineOrError(cached: GuardAuthSnapshot | null, error: unknown): GuardAuthSnapshot {
  if (cached?.status === "authenticated") {
    const result: GuardAuthSnapshot = {
      ...cached,
      updatedAt: now(),
      policy: { ...cached.policy, state: "offline" }
    };
    void persistPublicSnapshot(result);
    return result;
  }
  const expired = error instanceof Error && error.message === "session_expired";
  const result: GuardAuthSnapshot = {
    status: "error",
    localProtection: true,
    updatedAt: now(),
    code: expired ? "session_expired" : "sync_unavailable",
    message: expired
      ? "Your Accord session expired. Reconnect to sync organization policies."
      : "Local protection is active, but account sync is temporarily unavailable.",
    recoverable: true
  };
  void persistPublicSnapshot(result);
  return result;
}

async function readPublicSnapshot() {
  const value = await readStoredValue<GuardAuthSnapshot>(GUARD_PUBLIC_ACCOUNT_KEY);
  return isGuardAuthSnapshot(value) ? value : null;
}

async function persistPublicSnapshot(snapshot: GuardAuthSnapshot) {
  await writeStoredValue(GUARD_PUBLIC_ACCOUNT_KEY, snapshot);
}

export function isGuardAuthSnapshot(value: unknown): value is GuardAuthSnapshot {
  if (!isRecord(value) || value.localProtection !== true || typeof value.updatedAt !== "string") return false;

  if (value.status === "loading" || value.status === "signed_out" || value.status === "connecting") {
    return true;
  }

  if (value.status === "error") {
    return (
      typeof value.code === "string" &&
      typeof value.message === "string" &&
      typeof value.recoverable === "boolean" &&
      (value.cachedAccount === undefined || isCachedAccount(value.cachedAccount))
    );
  }

  if (value.status !== "authenticated") return false;
  if (!isGuardUser(value.user) || !isGuardPolicySync(value.policy)) return false;

  const organizationValid = value.organization === null || isGuardOrganization(value.organization);
  const membershipValid = value.membership === null || isGuardMembership(value.membership);
  const membershipPairValid = (value.organization === null) === (value.membership === null);
  return organizationValid && membershipValid && membershipPairValid;
}

function isCachedAccount(value: unknown) {
  if (!isRecord(value) || !isGuardUser(value.user)) return false;
  const organizationValid = value.organization === null || isGuardOrganization(value.organization);
  const membershipValid = value.membership === null || isGuardMembership(value.membership);
  return organizationValid && membershipValid && (value.organization === null) === (value.membership === null);
}

function isGuardUser(value: unknown) {
  return Boolean(
    isRecord(value) &&
      typeof value.id === "string" &&
      typeof value.email === "string" &&
      typeof value.displayName === "string" &&
      (value.avatarUrl === undefined || typeof value.avatarUrl === "string") &&
      (value.provider === undefined || value.provider === "google" || value.provider === "github")
  );
}

function isGuardOrganization(value: unknown) {
  return Boolean(
    isRecord(value) &&
      typeof value.id === "string" &&
      typeof value.slug === "string" &&
      typeof value.name === "string"
  );
}

function isGuardMembership(value: unknown) {
  return Boolean(
    isRecord(value) &&
      typeof value.id === "string" &&
      (value.role === "owner" || value.role === "admin" || value.role === "member" || value.role === "viewer") &&
      value.status === "active"
  );
}

function isGuardPolicySync(value: unknown) {
  if (!isRecord(value)) return false;
  const validState =
    value.state === "not_connected" ||
    value.state === "syncing" ||
    value.state === "synced" ||
    value.state === "none" ||
    value.state === "offline" ||
    value.state === "error";
  return Boolean(
    validState &&
      (value.bundleId === undefined || typeof value.bundleId === "string") &&
      (value.version === undefined || typeof value.version === "number") &&
      (value.activeRuleCount === undefined || typeof value.activeRuleCount === "number") &&
      (value.lastPublishedAt === undefined || typeof value.lastPublishedAt === "string") &&
      (value.lastSyncedAt === undefined || typeof value.lastSyncedAt === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function clearCorruptPublicSnapshotForTests() {
  await removeStoredValue(GUARD_PUBLIC_ACCOUNT_KEY);
}
