import { validatePublishedEnforcementBundle } from "@accord/governance-core";
import { getApiBaseUrl } from "../auth/config";
import { getGuardAccessToken, getGuardAuthSnapshot } from "../auth/session";
import type { GuardAuthSnapshot, GuardPolicySync, GuardPolicySyncError } from "../auth/types";
import { getLocalFallbackPolicyBundle, LOCAL_FALLBACK_POLICY_BUNDLE_ID } from "./local-fallback";
import type { PublishedPolicyBundle } from "./types";

const CACHE_KEY_PREFIX = "accordPolicyBundle";
const SYNC_METADATA_KEY_PREFIX = "accordPolicyBundleSync";
const FETCH_TTL_MS = 60_000;

export type ActivePolicyBundleState = "organization_synced" | "organization_cached" | "local_fallback";
export type ActivePolicyBundleSourceType = "organization" | "organization_cache" | "local_fallback";

export type ActivePolicyBundleStatus = {
  state: ActivePolicyBundleState;
  sourceType: ActivePolicyBundleSourceType;
  bundle: PublishedPolicyBundle;
  organizationId?: string;
  organizationName?: string;
  bundleId: string;
  version: number;
  ruleCount: number;
  lastPublishedAt?: string;
  lastSuccessfulSyncAt?: string;
  fallbackActive: boolean;
  organizationSpecificRulesAvailable: boolean;
  syncError?: GuardPolicySyncError;
};

type CachedBundleMetadata = {
  bundleId: string;
  version: number;
  ruleCount: number;
  lastPublishedAt?: string;
  lastSuccessfulSyncAt: string;
  checksum?: string;
};

let memoryCache: {
  organizationId: string;
  fetchedAt: number;
  status: ActivePolicyBundleStatus;
} | null = null;

export async function getActivePolicyBundle({ force = false }: { force?: boolean } = {}) {
  return (await getActivePolicyBundleStatus({ force })).bundle;
}

export async function getActivePolicyBundleStatus({ force = false }: { force?: boolean } = {}) {
  const requestedAt = new Date();
  const storage = globalThis.chrome?.storage?.local;

  if (!storage) {
    const status = localFallbackStatus({
      syncError: syncError("storage_unavailable", requestedAt, { recoverable: true })
    });
    logBundleDiagnostic(diagnosticForStatus(status, { requestStarted: false, responseReceived: false }));
    return status;
  }

  const account = await getGuardAuthSnapshot({ force });
  if (account.status !== "authenticated" || !account.organization || !account.membership) {
    const status = localFallbackStatus({
      organizationName: account.status === "authenticated" ? account.organization?.name : undefined,
      syncError: syncError(authErrorCategory(account), requestedAt, { recoverable: true })
    });
    logBundleDiagnostic(diagnosticForStatus(status, { requestStarted: false, responseReceived: false }));
    return status;
  }

  const organizationId = account.organization.id;
  const nowMs = requestedAt.getTime();

  if (!force && memoryCache && memoryCache.organizationId === organizationId && nowMs - memoryCache.fetchedAt < FETCH_TTL_MS) {
    logBundleDiagnostic(
      diagnosticForStatus(memoryCache.status, {
        requestStarted: false,
        responseReceived: false,
        validationPassed: memoryCache.status.state !== "local_fallback",
        cacheHit: memoryCache.status.state === "organization_cached"
      })
    );
    return memoryCache.status;
  }

  const cached = await readCachedBundle(organizationId);

  try {
    const accessToken = await getGuardAccessToken();
    if (!accessToken) {
      const status = cachedOrFallback({
        cached,
        account,
        syncError: syncError("access_token_unavailable", requestedAt, { recoverable: true })
      });
      memoryCache = { organizationId, fetchedAt: nowMs, status };
      logBundleDiagnostic(diagnosticForStatus(status, { requestStarted: false, responseReceived: false }));
      return status;
    }

    const apiBaseUrl = await getApiBaseUrl();
    const requestUrlHost = safeHost(apiBaseUrl);
    logBundleDiagnostic({
      requestStarted: true,
      requestUrlHost,
      responseReceived: false,
      validationPassed: false,
      cacheHit: false,
      cacheVersion: cached.bundle?.version,
      policyState: "syncing",
      sourceType: "organization",
      fallbackActive: false
    });

    const response = await fetch(`${apiBaseUrl}/api/guard/policy-bundle`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const status = cachedOrFallback({
        cached,
        account,
        syncError: syncError("http_response", requestedAt, { httpStatus: response.status, recoverable: true })
      });
      memoryCache = { organizationId, fetchedAt: nowMs, status };
      logBundleDiagnostic(
        diagnosticForStatus(status, {
          requestStarted: true,
          requestUrlHost,
          httpStatus: response.status,
          responseReceived: true,
          validationPassed: false
        })
      );
      return status;
    }

    const body = (await response.json()) as { bundle?: PublishedPolicyBundle | null };
    const bundle = isPublishedBundle(body.bundle) ? body.bundle : null;

    if (!bundle) {
      const status = cachedOrFallback({
        cached,
        account,
        syncError: syncError("schema_validation", requestedAt, { recoverable: true })
      });
      memoryCache = { organizationId, fetchedAt: nowMs, status };
      logBundleDiagnostic(
        diagnosticForStatus(status, {
          requestStarted: true,
          requestUrlHost,
          httpStatus: response.status,
          responseReceived: true,
          validationPassed: false,
          errorMessage: "Published bundle failed schema v2 validation.",
          ...bundleMetadata(body.bundle)
        })
      );
      return status;
    }

    const lastSuccessfulSyncAt = requestedAt.toISOString();
    await writeCachedBundle(organizationId, bundle, lastSuccessfulSyncAt);
    const status = organizationSyncedStatus({ account, bundle, lastSuccessfulSyncAt });
    memoryCache = { organizationId, fetchedAt: nowMs, status };
    logBundleDiagnostic(
      diagnosticForStatus(status, {
        requestStarted: true,
        requestUrlHost,
        httpStatus: response.status,
        responseReceived: true,
        validationPassed: true,
        ...bundleMetadata(bundle)
      })
    );
    return status;
  } catch (error) {
    const status = cachedOrFallback({
      cached,
      account,
      syncError: syncError("request", requestedAt, { recoverable: true })
    });
    memoryCache = { organizationId, fetchedAt: nowMs, status };
    const details = safeError(error);
    logBundleDiagnostic(
      diagnosticForStatus(status, {
        requestStarted: true,
        requestUrlHost: safeHost(await getApiBaseUrl()),
        responseReceived: false,
        validationPassed: false,
        errorName: details.name,
        errorMessage: details.message
      })
    );
    return status;
  }
}

export function policyStatusToGuardSync(status: ActivePolicyBundleStatus): GuardPolicySync {
  return {
    state: status.state,
    sourceType: status.sourceType,
    bundleId: status.bundleId,
    version: status.version,
    activeRuleCount: status.ruleCount,
    lastPublishedAt: status.lastPublishedAt,
    lastSyncedAt: status.lastSuccessfulSyncAt,
    lastSuccessfulSyncAt: status.lastSuccessfulSyncAt,
    fallbackActive: status.fallbackActive,
    organizationSpecificRulesAvailable: status.organizationSpecificRulesAvailable,
    syncError: status.syncError
  };
}

export function resetPolicyBundleMemoryCacheForTests() {
  memoryCache = null;
}

async function readCachedBundle(organizationId: string) {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return { bundle: null, metadata: null };

  return new Promise<{ bundle: PublishedPolicyBundle | null; metadata: CachedBundleMetadata | null }>((resolve) => {
    storage.get([cacheKey(organizationId), syncMetadataKey(organizationId)], (items) => {
      const bundleValue = items[cacheKey(organizationId)];
      const metadataValue = items[syncMetadataKey(organizationId)];
      resolve({
        bundle: isPublishedBundle(bundleValue) ? bundleValue : null,
        metadata: isCachedBundleMetadata(metadataValue) ? metadataValue : null
      });
    });
  });
}

async function writeCachedBundle(organizationId: string, bundle: PublishedPolicyBundle, lastSuccessfulSyncAt: string) {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return;

  const metadata: CachedBundleMetadata = {
    bundleId: bundle.id,
    version: bundle.version,
    ruleCount: bundle.rules.length,
    lastPublishedAt: bundle.publishedAt,
    lastSuccessfulSyncAt,
    checksum: bundle.checksum
  };

  await new Promise<void>((resolve) => {
    storage.set({ [cacheKey(organizationId)]: bundle, [syncMetadataKey(organizationId)]: metadata }, () => resolve());
  });
}

function cacheKey(organizationId: string) {
  return `${CACHE_KEY_PREFIX}:${organizationId}`;
}

function syncMetadataKey(organizationId: string) {
  return `${SYNC_METADATA_KEY_PREFIX}:${organizationId}`;
}

function isPublishedBundle(value: unknown): value is PublishedPolicyBundle {
  return validatePublishedEnforcementBundle(value);
}

function isCachedBundleMetadata(value: unknown): value is CachedBundleMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Boolean(
    typeof candidate.bundleId === "string" &&
      typeof candidate.version === "number" &&
      typeof candidate.ruleCount === "number" &&
      typeof candidate.lastSuccessfulSyncAt === "string" &&
      (candidate.lastPublishedAt === undefined || typeof candidate.lastPublishedAt === "string") &&
      (candidate.checksum === undefined || typeof candidate.checksum === "string")
  );
}

function cachedOrFallback({
  cached,
  account,
  syncError
}: {
  cached: { bundle: PublishedPolicyBundle | null; metadata: CachedBundleMetadata | null };
  account: Extract<GuardAuthSnapshot, { status: "authenticated" }>;
  syncError: GuardPolicySyncError;
}) {
  if (cached.bundle) {
    return organizationCachedStatus({
      account,
      bundle: cached.bundle,
      lastSuccessfulSyncAt: cached.metadata?.lastSuccessfulSyncAt,
      syncError
    });
  }

  return localFallbackStatus({
    organizationName: account.organization?.name,
    syncError
  });
}

function organizationSyncedStatus({
  account,
  bundle,
  lastSuccessfulSyncAt
}: {
  account: Extract<GuardAuthSnapshot, { status: "authenticated" }>;
  bundle: PublishedPolicyBundle;
  lastSuccessfulSyncAt: string;
}): ActivePolicyBundleStatus {
  return {
    state: "organization_synced",
    sourceType: "organization",
    organizationId: account.organization?.id,
    organizationName: account.organization?.name,
    bundle,
    bundleId: bundle.id,
    version: bundle.version,
    ruleCount: bundle.rules.length,
    lastPublishedAt: bundle.publishedAt,
    lastSuccessfulSyncAt,
    fallbackActive: false,
    organizationSpecificRulesAvailable: true
  };
}

function organizationCachedStatus({
  account,
  bundle,
  lastSuccessfulSyncAt,
  syncError
}: {
  account: Extract<GuardAuthSnapshot, { status: "authenticated" }>;
  bundle: PublishedPolicyBundle;
  lastSuccessfulSyncAt?: string;
  syncError: GuardPolicySyncError;
}): ActivePolicyBundleStatus {
  return {
    state: "organization_cached",
    sourceType: "organization_cache",
    organizationId: account.organization?.id,
    organizationName: account.organization?.name,
    bundle,
    bundleId: bundle.id,
    version: bundle.version,
    ruleCount: bundle.rules.length,
    lastPublishedAt: bundle.publishedAt,
    lastSuccessfulSyncAt,
    fallbackActive: false,
    organizationSpecificRulesAvailable: true,
    syncError
  };
}

function localFallbackStatus({
  organizationName,
  syncError
}: {
  organizationName?: string;
  syncError?: GuardPolicySyncError;
}): ActivePolicyBundleStatus {
  const bundle = getLocalFallbackPolicyBundle();
  return {
    state: "local_fallback",
    sourceType: "local_fallback",
    organizationName,
    bundle,
    bundleId: LOCAL_FALLBACK_POLICY_BUNDLE_ID,
    version: bundle.version,
    ruleCount: bundle.rules.length,
    lastPublishedAt: bundle.publishedAt,
    fallbackActive: true,
    organizationSpecificRulesAvailable: false,
    syncError
  };
}

function authErrorCategory(account: GuardAuthSnapshot): GuardPolicySyncError["category"] {
  if (account.status === "authenticated") return "no_organization";
  if (account.status === "error") return "account_sync_unavailable";
  return "not_authenticated";
}

function syncError(
  category: GuardPolicySyncError["category"],
  occurredAt: Date,
  options: { httpStatus?: number; recoverable: boolean }
): GuardPolicySyncError {
  return {
    category,
    httpStatus: options.httpStatus,
    occurredAt: occurredAt.toISOString(),
    recoverable: options.recoverable
  };
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
  policyState?: string;
  sourceType?: string;
  fallbackActive?: boolean;
};

function diagnosticForStatus(
  status: ActivePolicyBundleStatus,
  input: Partial<BundleDiagnostic> & Pick<BundleDiagnostic, "requestStarted" | "responseReceived">
): BundleDiagnostic {
  return {
    ...input,
    validationPassed: input.validationPassed ?? status.state === "organization_synced",
    cacheHit: input.cacheHit ?? status.state === "organization_cached",
    cacheVersion: input.cacheVersion ?? (status.state === "organization_cached" ? status.version : undefined),
    errorStage: input.errorStage ?? status.syncError?.category,
    httpStatus: input.httpStatus ?? status.syncError?.httpStatus,
    policyState: status.state,
    sourceType: status.sourceType,
    fallbackActive: status.fallbackActive,
    ...bundleMetadata(status.bundle)
  };
}

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
