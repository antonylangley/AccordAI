import { validatePublishedEnforcementBundle } from "@accord/governance-core";
import type { PublishedPolicyBundle } from "./types";

const DEFAULT_API_BASE_URL = "https://www.accordgovernance.com";
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
  if (!globalThis.chrome?.storage?.local) {
    logBundleDiagnostic({
      requestStarted: false,
      responseReceived: false,
      validationPassed: false,
      cacheHit: false,
      errorStage: "storage_unavailable"
    });
    return null;
  }

  const settings = await getSettings();
  const companySlug = normalizeSlug(settings[COMPANY_SLUG_KEY] || "test-company");
  const now = Date.now();

  if (memoryCache && memoryCache.companySlug === companySlug && now - memoryCache.fetchedAt < FETCH_TTL_MS) {
    logBundleDiagnostic({
      requestStarted: false,
      responseReceived: false,
      validationPassed: memoryCache.bundle !== null,
      cacheHit: true,
      cacheVersion: memoryCache.bundle?.version,
      ...bundleMetadata(memoryCache.bundle)
    });
    return memoryCache.bundle;
  }

  const cached = await readCachedBundle(companySlug);

  try {
    const apiBaseUrl = sanitizeApiBaseUrl(settings[API_BASE_URL_KEY] || DEFAULT_API_BASE_URL);
    const requestUrlHost = safeHost(apiBaseUrl);
    logBundleDiagnostic({
      requestStarted: true,
      requestUrlHost,
      responseReceived: false,
      validationPassed: false,
      cacheHit: false,
      cacheVersion: cached?.version
    });
    const response = await fetch(`${apiBaseUrl}/api/guard/policy-bundle?companySlug=${encodeURIComponent(companySlug)}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      logBundleDiagnostic({
        requestStarted: true,
        requestUrlHost,
        httpStatus: response.status,
        responseReceived: true,
        validationPassed: false,
        cacheHit: cached !== null,
        cacheVersion: cached?.version,
        errorStage: "http_response"
      });
      memoryCache = { companySlug, fetchedAt: now, bundle: cached };
      return cached;
    }

    const body = (await response.json()) as { bundle?: PublishedPolicyBundle | null };
    const bundle = isPublishedBundle(body.bundle) ? body.bundle : null;
    logBundleDiagnostic({
      requestStarted: true,
      requestUrlHost,
      httpStatus: response.status,
      responseReceived: true,
      validationPassed: bundle !== null,
      cacheHit: bundle === null && cached !== null,
      cacheVersion: cached?.version,
      errorStage: bundle === null ? "schema_validation" : undefined,
      errorMessage: bundle === null ? "Published bundle failed schema v2 validation." : undefined,
      ...bundleMetadata(body.bundle)
    });
    if (bundle) await writeCachedBundle(companySlug, bundle);
    memoryCache = { companySlug, fetchedAt: now, bundle };
    return bundle || cached;
  } catch (error) {
    const details = safeError(error);
    logBundleDiagnostic({
      requestStarted: true,
      requestUrlHost: safeHost(settings[API_BASE_URL_KEY] || DEFAULT_API_BASE_URL),
      responseReceived: false,
      validationPassed: false,
      cacheHit: cached !== null,
      cacheVersion: cached?.version,
      errorStage: "request",
      errorName: details.name,
      errorMessage: details.message
    });
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
  return validatePublishedEnforcementBundle(value);
}

type BundleDiagnostic = {
  requestStarted: boolean;
  requestUrlHost?: string;
  httpStatus?: number;
  responseReceived: boolean;
  schemaVersion?: number;
  bundleVersion?: number;
  bundleChecksum?: string;
  totalRuleCount?: number;
  enabledBuiltInBundleCount?: number;
  approvedProviderCount?: number;
  cacheHit: boolean;
  cacheVersion?: number;
  validationPassed: boolean;
  errorStage?: string;
  errorName?: string;
  errorMessage?: string;
};

function bundleMetadata(value: unknown): Partial<BundleDiagnostic> {
  if (!value || typeof value !== "object") return {};
  const candidate = value as Record<string, unknown>;
  return {
    schemaVersion: typeof candidate.schemaVersion === "number" ? candidate.schemaVersion : undefined,
    bundleVersion: typeof candidate.version === "number" ? candidate.version : undefined,
    bundleChecksum: typeof candidate.checksum === "string" ? candidate.checksum : undefined,
    totalRuleCount: Array.isArray(candidate.rules) ? candidate.rules.length : undefined,
    enabledBuiltInBundleCount: Array.isArray(candidate.enabledBuiltInBundleIds) ? candidate.enabledBuiltInBundleIds.length : undefined,
    approvedProviderCount: Array.isArray(candidate.approvedProviders) ? candidate.approvedProviders.length : undefined
  };
}

function safeHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "invalid_url";
  }
}

function safeError(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError", message: String(error) };
}

function logBundleDiagnostic(diagnostic: BundleDiagnostic) {
  console.info("[Accord Policy] bundle fetch", diagnostic);
}
