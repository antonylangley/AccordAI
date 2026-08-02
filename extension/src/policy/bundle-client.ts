import type { PublishedPolicyBundle } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";
const API_BASE_URL_KEY = "accordApiBaseUrl";
const COMPANY_SLUG_KEY = "accordCompanySlug";
const CACHE_KEY_PREFIX = "accordPolicyBundle";
const FETCH_TTL_MS = 60_000;

let memoryCache: {
  companySlug: string;
  fetchedAt: number;
  bundle: PublishedPolicyBundle | null;
} | null = null;

export async function getActivePolicyBundle() {
  if (!globalThis.chrome?.storage?.local) return null;

  const settings = await getSettings();
  const companySlug = normalizeSlug(settings[COMPANY_SLUG_KEY] || "test-company");
  const now = Date.now();

  if (memoryCache && memoryCache.companySlug === companySlug && now - memoryCache.fetchedAt < FETCH_TTL_MS) {
    return memoryCache.bundle;
  }

  const cached = await readCachedBundle(companySlug);

  try {
    const apiBaseUrl = sanitizeApiBaseUrl(settings[API_BASE_URL_KEY] || DEFAULT_API_BASE_URL);
    const response = await fetch(`${apiBaseUrl}/api/guard/policy-bundle?companySlug=${encodeURIComponent(companySlug)}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      memoryCache = { companySlug, fetchedAt: now, bundle: cached };
      return cached;
    }

    const body = (await response.json()) as { bundle?: PublishedPolicyBundle | null };
    const bundle = isPublishedBundle(body.bundle) ? body.bundle : null;
    if (bundle) await writeCachedBundle(companySlug, bundle);
    memoryCache = { companySlug, fetchedAt: now, bundle };
    return bundle || cached;
  } catch {
    memoryCache = { companySlug, fetchedAt: now, bundle: cached };
    return cached;
  }
}

export function resetPolicyBundleMemoryCacheForTests() {
  memoryCache = null;
}

async function readCachedBundle(companySlug: string) {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return null;

  return new Promise<PublishedPolicyBundle | null>((resolve) => {
    storage.get(cacheKey(companySlug), (items) => {
      const value = items[cacheKey(companySlug)];
      resolve(isPublishedBundle(value) ? value : null);
    });
  });
}

async function writeCachedBundle(companySlug: string, bundle: PublishedPolicyBundle) {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return;

  await new Promise<void>((resolve) => {
    storage.set({ [cacheKey(companySlug)]: bundle }, () => resolve());
  });
}

function getSettings(): Promise<Record<string, string | undefined>> {
  return new Promise((resolve) => {
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) {
      resolve({});
      return;
    }

    storage.get([API_BASE_URL_KEY, COMPANY_SLUG_KEY], (items) => {
      resolve(items as Record<string, string | undefined>);
    });
  });
}

function cacheKey(companySlug: string) {
  return `${CACHE_KEY_PREFIX}:${companySlug}`;
}

function sanitizeApiBaseUrl(value: string) {
  return value.replace(/\/+$/, "") || DEFAULT_API_BASE_URL;
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "test-company";
}

function isPublishedBundle(value: unknown): value is PublishedPolicyBundle {
  if (!value || typeof value !== "object") return false;
  const bundle = value as PublishedPolicyBundle;
  return (
    typeof bundle.id === "string" &&
    typeof bundle.companySlug === "string" &&
    typeof bundle.version === "number" &&
    typeof bundle.checksum === "string" &&
    Array.isArray(bundle.rules)
  );
}
