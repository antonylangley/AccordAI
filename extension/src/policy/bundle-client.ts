import { validatePublishedEnforcementBundle } from "@accord/governance-core";
import { getApiBaseUrl } from "../auth/config";
import { getGuardAccessToken, getGuardAuthSnapshot } from "../auth/session";
import type { PublishedPolicyBundle } from "./types";

const CACHE_KEY_PREFIX = "accordPolicyBundle";
const FETCH_TTL_MS = 60_000;

let memoryCache: {
  organizationId: string;
  fetchedAt: number;
  bundle: PublishedPolicyBundle | null;
} | null = null;

export async function getActivePolicyBundle({ force = false }: { force?: boolean } = {}) {
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

  const account = await getGuardAuthSnapshot();
  if (account.status !== "authenticated" || !account.organization || !account.membership) {
    logBundleDiagnostic({
      requestStarted: false,
      responseReceived: false,
      validationPassed: false,
      cacheHit: false,
      errorStage: "not_authenticated"
    });
    return null;
  }

  const organizationId = account.organization.id;
  const now = Date.now();

  if (!force && memoryCache && memoryCache.organizationId === organizationId && now - memoryCache.fetchedAt < FETCH_TTL_MS) {
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

  const cached = await readCachedBundle(organizationId);

  try {
    const accessToken = await getGuardAccessToken();
    if (!accessToken) return cached;
    const apiBaseUrl = await getApiBaseUrl();
    const requestUrlHost = safeHost(apiBaseUrl);
    logBundleDiagnostic({
      requestStarted: true,
      requestUrlHost,
      responseReceived: false,
      validationPassed: false,
      cacheHit: false,
      cacheVersion: cached?.version
    });
    const response = await fetch(`${apiBaseUrl}/api/guard/policy-bundle`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` }
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
      memoryCache = { organizationId, fetchedAt: now, bundle: cached };
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
    if (bundle) await writeCachedBundle(organizationId, bundle);
    memoryCache = { organizationId, fetchedAt: now, bundle };
    return bundle || cached;
  } catch (error) {
    const details = safeError(error);
    logBundleDiagnostic({
      requestStarted: true,
      requestUrlHost: safeHost(await getApiBaseUrl()),
      responseReceived: false,
      validationPassed: false,
      cacheHit: cached !== null,
      cacheVersion: cached?.version,
      errorStage: "request",
      errorName: details.name,
      errorMessage: details.message
    });
    memoryCache = { organizationId, fetchedAt: now, bundle: cached };
    return cached;
  }
}

export function resetPolicyBundleMemoryCacheForTests() {
  memoryCache = null;
}

async function readCachedBundle(organizationId: string) {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return null;

  return new Promise<PublishedPolicyBundle | null>((resolve) => {
    storage.get(cacheKey(organizationId), (items) => {
      const value = items[cacheKey(organizationId)];
      resolve(isPublishedBundle(value) ? value : null);
    });
  });
}

async function writeCachedBundle(organizationId: string, bundle: PublishedPolicyBundle) {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return;

  await new Promise<void>((resolve) => {
    storage.set({ [cacheKey(organizationId)]: bundle }, () => resolve());
  });
}

function cacheKey(organizationId: string) {
  return `${CACHE_KEY_PREFIX}:${organizationId}`;
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
