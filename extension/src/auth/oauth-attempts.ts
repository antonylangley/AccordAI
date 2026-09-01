import type { SupabaseClient } from "@supabase/supabase-js";
import { chromeExtensionAuthStorage, GUARD_AUTH_STORAGE_PREFIX, readStoredValue, writeStoredValue } from "./storage";
import type { GuardAuthProvider } from "./types";

export const GUARD_OAUTH_ATTEMPTS_KEY = `${GUARD_AUTH_STORAGE_PREFIX}oauthAttempts`;
export const GUARD_OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1000;

export type GuardOAuthAttempt = {
  provider: GuardAuthProvider;
  redirectUrl: string;
  createdAt: string;
  codeVerifier: string;
  codeVerifierStorageKey: string;
};

type GuardOAuthAttempts = Record<string, GuardOAuthAttempt>;

const now = () => new Date().toISOString();

export function createGuardOAuthState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function oauthAttemptId(state: string) {
  return state.slice(0, 8);
}

export async function clearSupabasePkceVerifier(client: SupabaseClient) {
  await chromeExtensionAuthStorage.removeItem(codeVerifierStorageKeyForClient(client));
}

export async function rememberGuardOAuthAttempt({
  state,
  provider,
  redirectUrl,
  client
}: {
  state: string;
  provider: GuardAuthProvider;
  redirectUrl: string;
  client: SupabaseClient;
}) {
  const codeVerifierStorageKey = codeVerifierStorageKeyForClient(client);
  const codeVerifier = await chromeExtensionAuthStorage.getItem(codeVerifierStorageKey);
  if (!codeVerifier) throw new Error("oauth_verifier_missing");

  const attempts = await readGuardOAuthAttempts();
  attempts[state] = {
    provider,
    redirectUrl,
    createdAt: now(),
    codeVerifier,
    codeVerifierStorageKey
  };
  await writeGuardOAuthAttempts(pruneGuardOAuthAttempts(attempts));
}

export async function restoreGuardOAuthAttempt({
  state,
  provider,
  redirectUrl,
  client
}: {
  state: string;
  provider: GuardAuthProvider;
  redirectUrl: string;
  client: SupabaseClient;
}) {
  const attempts = await readGuardOAuthAttempts();
  const attempt = attempts[state];
  if (!attempt || isGuardOAuthAttemptExpired(attempt)) {
    delete attempts[state];
    await writeGuardOAuthAttempts(pruneGuardOAuthAttempts(attempts));
    return null;
  }

  if (attempt.provider !== provider || attempt.redirectUrl !== redirectUrl) {
    return null;
  }

  const codeVerifierStorageKey = codeVerifierStorageKeyForClient(client);
  if (attempt.codeVerifierStorageKey !== codeVerifierStorageKey) {
    return null;
  }

  await chromeExtensionAuthStorage.setItem(codeVerifierStorageKey, attempt.codeVerifier);
  return attempt;
}

export async function clearGuardOAuthAttempt(state: string, client?: SupabaseClient) {
  const attempts = await readGuardOAuthAttempts();
  delete attempts[state];
  await writeGuardOAuthAttempts(pruneGuardOAuthAttempts(attempts));
  if (client) await clearSupabasePkceVerifier(client);
}

export async function pruneStoredGuardOAuthAttempts() {
  await writeGuardOAuthAttempts(pruneGuardOAuthAttempts(await readGuardOAuthAttempts()));
}

export function codeVerifierStorageKeyForClient(client: SupabaseClient) {
  const storageKey = (client.auth as unknown as { storageKey?: unknown }).storageKey;
  if (typeof storageKey !== "string" || !storageKey) {
    throw new Error("oauth_storage_key_unavailable");
  }
  return `${storageKey}-code-verifier`;
}

function pruneGuardOAuthAttempts(attempts: GuardOAuthAttempts): GuardOAuthAttempts {
  return Object.fromEntries(
    Object.entries(attempts).filter(([, attempt]) => isGuardOAuthAttempt(attempt) && !isGuardOAuthAttemptExpired(attempt))
  );
}

function isGuardOAuthAttemptExpired(attempt: GuardOAuthAttempt) {
  const createdAt = new Date(attempt.createdAt).getTime();
  return Number.isNaN(createdAt) || Date.now() - createdAt > GUARD_OAUTH_ATTEMPT_TTL_MS;
}

async function readGuardOAuthAttempts(): Promise<GuardOAuthAttempts> {
  const value = await readStoredValue<unknown>(GUARD_OAUTH_ATTEMPTS_KEY);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, attempt]) => isGuardOAuthAttempt(attempt)));
}

async function writeGuardOAuthAttempts(attempts: GuardOAuthAttempts) {
  await writeStoredValue(GUARD_OAUTH_ATTEMPTS_KEY, attempts);
}

function isGuardOAuthAttempt(value: unknown): value is GuardOAuthAttempt {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ((value as GuardOAuthAttempt).provider === "google" || (value as GuardOAuthAttempt).provider === "github") &&
      typeof (value as GuardOAuthAttempt).redirectUrl === "string" &&
      typeof (value as GuardOAuthAttempt).createdAt === "string" &&
      typeof (value as GuardOAuthAttempt).codeVerifier === "string" &&
      typeof (value as GuardOAuthAttempt).codeVerifierStorageKey === "string"
  );
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
