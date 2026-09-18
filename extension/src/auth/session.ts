import type { Session, User } from "@supabase/supabase-js";
import { getApiBaseUrl } from "./config";
import { getGuardAuthClient } from "./client";
import {
  clearGuardOAuthAttempt,
  clearSupabasePkceVerifier,
  createGuardOAuthState,
  oauthAttemptId,
  pruneStoredGuardOAuthAttempts,
  rememberGuardOAuthAttempt,
  restoreGuardOAuthAttempt
} from "./oauth-attempts";
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
  GuardPolicySync,
  GuardPolicySyncError
} from "./types";
import {
  LOCAL_FALLBACK_POLICY_BUNDLE_ID,
  LOCAL_FALLBACK_POLICY_RULE_COUNT,
  LOCAL_FALLBACK_POLICY_VERSION
} from "../policy/local-fallback";

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
  let attemptState: string | null = null;
  let attemptClient: Awaited<ReturnType<typeof getGuardAuthClient>> | null = null;
  try {
    const identity = globalThis.chrome?.identity;
    if (!identity?.launchWebAuthFlow) throw new Error("Chrome identity is unavailable.");
    const client = await getGuardAuthClient();
    attemptClient = client;
    const redirectTo = identity.getRedirectURL("auth/callback");
    const state = createGuardOAuthState();
    attemptState = state;
    await pruneStoredGuardOAuthAttempts();
    await clearSupabasePkceVerifier(client);
    logAuthDiagnostic("attempt_started", {
      provider,
      attemptId: oauthAttemptId(state),
      redirectHost: safeHost(redirectTo)
    });
    // Supabase owns the provider-facing OAuth state parameter and replaces any
    // caller-supplied value. Accord binds the callback with its stored PKCE
    // verifier plus the expected provider, redirect URL, and attempt TTL.
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true }
    });
    if (error || !data.url) throw error || new Error("Accord could not start OAuth.");
    await rememberGuardOAuthAttempt({ state, provider, redirectUrl: redirectTo, client });
    logAuthDiagnostic("authorize_url_ready", { provider, attemptId: oauthAttemptId(state) });
    const callbackUrl = await launchAuthFlow(data.url);
    const parsedCallback = new URL(callbackUrl);
    const providerError = parsedCallback.searchParams.get("error");
    const callbackMatched = matchesOAuthCallback(parsedCallback, redirectTo);
    logAuthDiagnostic("redirect_received", {
      provider,
      attemptId: oauthAttemptId(state),
      callbackHost: safeHost(callbackUrl),
      callbackMatched,
      hasCode: parsedCallback.searchParams.has("code"),
      hasProviderError: Boolean(providerError)
    });

    if (providerError) throw new Error(providerError);
    if (!callbackMatched) throw new Error("oauth_callback_mismatch");
    const attempt = await restoreGuardOAuthAttempt({ state, provider, redirectUrl: redirectTo, client });
    logAuthDiagnostic(attempt ? "verifier_found" : "verifier_missing", {
      provider,
      attemptId: oauthAttemptId(state)
    });
    if (!attempt) throw new Error("oauth_session_expired");
    const code = parsedCallback.searchParams.get("code");
    if (!code) throw new Error("The OAuth provider did not return an authorization code.");
    const exchange = await client.auth.exchangeCodeForSession(code);
    if (exchange.error || !exchange.data.session) throw exchange.error || new Error("Accord could not create a session.");
    await clearGuardOAuthAttempt(state);
    logAuthDiagnostic("code_exchange_succeeded", { provider, attemptId: oauthAttemptId(state) });
    return bootstrapSession(exchange.data.session, null);
  } catch (error) {
    if (attemptState) await clearGuardOAuthAttempt(attemptState, attemptClient ?? undefined).catch(() => undefined);
    logAuthDiagnostic("attempt_failed", {
      provider,
      attemptId: attemptState ? oauthAttemptId(attemptState) : undefined,
      reasonCategory: oauthErrorCode(error)
    });
    const message = error instanceof Error ? error.message : "Accord account connection failed.";
    const cancelled = /cancel|closed|window/i.test(message);
    const expired = isRecoverableOAuthAttemptError(message);
    const result: GuardAuthSnapshot = {
      status: "error",
      localProtection: true,
      updatedAt: now(),
      code: cancelled ? "oauth_cancelled" : expired ? "oauth_session_expired" : "oauth_failed",
      message: cancelled
        ? "Account connection was cancelled."
        : expired
          ? "Sign-in session expired. Please try signing in again."
          : "Accord could not connect your account. Please try again.",
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
      ? {
          ...body.policy,
          state: "syncing",
          sourceType: "organization",
          fallbackActive: true,
          organizationSpecificRulesAvailable: false
        }
      : localFallbackPolicySync(
          identityMissingOrganization(body)
            ? syncError("no_organization", { recoverable: true })
            : undefined
        );
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
    policy: localFallbackPolicySync(syncError("account_sync_unavailable", { recoverable: true }))
  };
}

function isRecoverableOAuthAttemptError(message: string) {
  return /pkce|code verifier|oauth_session_expired|oauth_state_mismatch|oauth_verifier_missing|oauth_storage_key_unavailable/i.test(message);
}

function oauthErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/cancel|closed|window/i.test(message)) return "oauth_cancelled";
  if (isRecoverableOAuthAttemptError(message)) return "oauth_session_expired";
  return "oauth_failed";
}

function safeHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "unknown";
  }
}

function matchesOAuthCallback(callback: URL, expectedRedirect: string) {
  try {
    const expected = new URL(expectedRedirect);
    return (
      callback.protocol === expected.protocol &&
      callback.host === expected.host &&
      callback.pathname === expected.pathname &&
      callback.username === expected.username &&
      callback.password === expected.password
    );
  } catch {
    return false;
  }
}

function logAuthDiagnostic(event: string, metadata: Record<string, unknown>) {
  console.info("[Accord Guard auth]", { event, ...metadata });
}

function offlineOrError(cached: GuardAuthSnapshot | null, error: unknown): GuardAuthSnapshot {
  if (cached?.status === "authenticated") {
    const result: GuardAuthSnapshot = {
      ...cached,
      updatedAt: now(),
      policy: offlinePolicySync(cached.policy)
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

function identityMissingOrganization(body: GuardBootstrapResponse) {
  return body.organization === null || body.membership === null;
}

function localFallbackPolicySync(syncErrorValue?: GuardPolicySyncError): GuardPolicySync {
  return {
    state: "local_fallback",
    sourceType: "local_fallback",
    bundleId: LOCAL_FALLBACK_POLICY_BUNDLE_ID,
    version: LOCAL_FALLBACK_POLICY_VERSION,
    activeRuleCount: LOCAL_FALLBACK_POLICY_RULE_COUNT,
    fallbackActive: true,
    organizationSpecificRulesAvailable: false,
    syncError: syncErrorValue
  };
}

function offlinePolicySync(policy: GuardPolicySync): GuardPolicySync {
  const error = syncError("account_sync_unavailable", { recoverable: true });
  if (hasOrganizationPolicyMetadata(policy)) {
    return {
      ...policy,
      state: "organization_cached",
      sourceType: "organization_cache",
      fallbackActive: false,
      organizationSpecificRulesAvailable: true,
      syncError: error
    };
  }

  return {
    ...localFallbackPolicySync(error),
    lastSuccessfulSyncAt: policy.lastSuccessfulSyncAt,
    lastSyncedAt: policy.lastSyncedAt
  };
}

function hasOrganizationPolicyMetadata(policy: GuardPolicySync) {
  return Boolean(
    policy.bundleId &&
      policy.bundleId !== LOCAL_FALLBACK_POLICY_BUNDLE_ID &&
      (policy.state === "organization_synced" ||
        policy.state === "organization_cached" ||
        policy.state === "synced" ||
        policy.state === "offline")
  );
}

function syncError(
  category: GuardPolicySyncError["category"],
  options: { httpStatus?: number; recoverable: boolean }
): GuardPolicySyncError {
  return {
    category,
    httpStatus: options.httpStatus,
    occurredAt: now(),
    recoverable: options.recoverable
  };
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
    value.state === "organization_synced" ||
    value.state === "organization_cached" ||
    value.state === "local_fallback" ||
    value.state === "none" ||
    value.state === "offline" ||
    value.state === "error";
  return Boolean(
    validState &&
      (value.sourceType === undefined ||
        value.sourceType === "organization" ||
        value.sourceType === "organization_cache" ||
        value.sourceType === "local_fallback" ||
        value.sourceType === "none") &&
      (value.bundleId === undefined || typeof value.bundleId === "string") &&
      (value.version === undefined || typeof value.version === "number") &&
      (value.activeRuleCount === undefined || typeof value.activeRuleCount === "number") &&
      (value.lastPublishedAt === undefined || typeof value.lastPublishedAt === "string") &&
      (value.lastSyncedAt === undefined || typeof value.lastSyncedAt === "string") &&
      (value.lastSuccessfulSyncAt === undefined || typeof value.lastSuccessfulSyncAt === "string") &&
      (value.fallbackActive === undefined || typeof value.fallbackActive === "boolean") &&
      (value.organizationSpecificRulesAvailable === undefined ||
        typeof value.organizationSpecificRulesAvailable === "boolean") &&
      (value.syncError === undefined || isGuardPolicySyncError(value.syncError))
  );
}

function isGuardPolicySyncError(value: unknown) {
  if (!isRecord(value)) return false;
  const validCategory =
    value.category === "not_authenticated" ||
    value.category === "no_organization" ||
    value.category === "storage_unavailable" ||
    value.category === "access_token_unavailable" ||
    value.category === "http_response" ||
    value.category === "schema_validation" ||
    value.category === "request" ||
    value.category === "account_sync_unavailable" ||
    value.category === "unknown";

  return Boolean(
    validCategory &&
      (value.httpStatus === undefined || typeof value.httpStatus === "number") &&
      typeof value.occurredAt === "string" &&
      typeof value.recoverable === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function clearCorruptPublicSnapshotForTests() {
  await removeStoredValue(GUARD_PUBLIC_ACCOUNT_KEY);
}
