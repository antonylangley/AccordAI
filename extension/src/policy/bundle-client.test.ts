import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POLICY_SCHEMA_VERSION } from "@accord/governance-core";
import {
  getActivePolicyBundle,
  getActivePolicyBundleStatus,
  resetPolicyBundleMemoryCacheForTests
} from "./bundle-client";
import { LOCAL_FALLBACK_POLICY_BUNDLE_ID, LOCAL_FALLBACK_POLICY_RULE_COUNT } from "./local-fallback";
import type { PublishedPolicyBundle } from "./types";

const auth = vi.hoisted(() => ({
  snapshot: vi.fn(),
  token: vi.fn(),
  apiBaseUrl: vi.fn()
}));

vi.mock("../auth/session", () => ({
  getGuardAuthSnapshot: auth.snapshot,
  getGuardAccessToken: auth.token
}));

vi.mock("../auth/config", () => ({ getApiBaseUrl: auth.apiBaseUrl }));

const store: Record<string, unknown> = {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-21T00:00:00.000Z"));
  vi.clearAllMocks();
  resetPolicyBundleMemoryCacheForTests();
  auth.snapshot.mockResolvedValue(authenticatedSnapshot("org_1"));
  auth.token.mockResolvedValue("test-access-token");
  auth.apiBaseUrl.mockResolvedValue("https://www.accordgovernance.com");
  for (const key of Object.keys(store)) delete store[key];
  globalThis.chrome = {
    storage: {
      local: {
        get(keys: string | string[], callback: (items: Record<string, unknown>) => void) {
          const keyList = Array.isArray(keys) ? keys : [keys];
          callback(Object.fromEntries(keyList.map((key) => [key, store[key]])));
        },
        set(items: Record<string, unknown>, callback?: () => void) {
          Object.assign(store, items);
          callback?.();
        }
      }
    }
  } as unknown as typeof chrome;
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("policy bundle client", () => {
  test("fetches, caches, and reports the latest organization policy bundle", async () => {
    const bundle = testBundle(2);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ bundle })
      }))
    );

    const status = await getActivePolicyBundleStatus({ force: true });

    expect(status).toMatchObject({
      state: "organization_synced",
      sourceType: "organization",
      bundleId: "bundle_2",
      version: 2,
      ruleCount: 0,
      fallbackActive: false,
      organizationSpecificRulesAvailable: true,
      lastSuccessfulSyncAt: "2026-08-21T00:00:00.000Z"
    });
    expect(store["accordPolicyBundle:org_1"]).toEqual(bundle);
    expect(store["accordPolicyBundleSync:org_1"]).toMatchObject({
      bundleId: "bundle_2",
      version: 2,
      lastSuccessfulSyncAt: "2026-08-21T00:00:00.000Z"
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://www.accordgovernance.com/api/guard/policy-bundle",
      { cache: "no-store", headers: { Authorization: "Bearer test-access-token" } }
    );
  });

  test("returns the active bundle for Guard evaluation", async () => {
    const bundle = testBundle(2);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ bundle })
      }))
    );

    await expect(getActivePolicyBundle({ force: true })).resolves.toEqual(bundle);
  });

  test("rejects an invalid response and preserves a valid cached v2 bundle", async () => {
    const cached = testBundle(3);
    store["accordPolicyBundle:org_1"] = cached;
    store["accordPolicyBundleSync:org_1"] = {
      bundleId: cached.id,
      version: cached.version,
      ruleCount: cached.rules.length,
      lastPublishedAt: cached.publishedAt,
      lastSuccessfulSyncAt: "2026-08-20T00:00:00.000Z",
      checksum: cached.checksum
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ bundle: { id: "legacy", version: 12, rules: [] } })
      }))
    );

    const status = await getActivePolicyBundleStatus({ force: true });

    expect(status).toMatchObject({
      state: "organization_cached",
      sourceType: "organization_cache",
      bundleId: cached.id,
      version: cached.version,
      fallbackActive: false,
      organizationSpecificRulesAvailable: true,
      lastSuccessfulSyncAt: "2026-08-20T00:00:00.000Z",
      syncError: { category: "schema_validation", recoverable: true }
    });
    expect(store["accordPolicyBundle:org_1"]).toEqual(cached);
    expect(store["accordPolicyBundleSync:org_1"]).toMatchObject({
      lastSuccessfulSyncAt: "2026-08-20T00:00:00.000Z"
    });
  });

  test("uses cached organization policy when the endpoint is offline", async () => {
    const cached = testBundle(1);
    store["accordPolicyBundle:org_1"] = cached;
    store["accordPolicyBundleSync:org_1"] = {
      bundleId: cached.id,
      version: cached.version,
      ruleCount: cached.rules.length,
      lastPublishedAt: cached.publishedAt,
      lastSuccessfulSyncAt: "2026-08-19T00:00:00.000Z",
      checksum: cached.checksum
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );

    const status = await getActivePolicyBundleStatus({ force: true });

    expect(status).toMatchObject({
      state: "organization_cached",
      sourceType: "organization_cache",
      bundleId: "bundle_1",
      version: 1,
      fallbackActive: false,
      organizationSpecificRulesAvailable: true,
      lastSuccessfulSyncAt: "2026-08-19T00:00:00.000Z",
      syncError: { category: "request", recoverable: true }
    });
  });

  test("uses packaged local fallback when no organization bundle can be used", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );

    const status = await getActivePolicyBundleStatus({ force: true });

    expect(status).toMatchObject({
      state: "local_fallback",
      sourceType: "local_fallback",
      bundleId: LOCAL_FALLBACK_POLICY_BUNDLE_ID,
      ruleCount: LOCAL_FALLBACK_POLICY_RULE_COUNT,
      fallbackActive: true,
      organizationSpecificRulesAvailable: false,
      syncError: { category: "request", recoverable: true }
    });
    expect(status.bundle.id).toBe(LOCAL_FALLBACK_POLICY_BUNDLE_ID);
    expect(status.bundle.rules).toHaveLength(11);
  });

  test("retry transitions from local fallback back to organization policy active", async () => {
    const bundle = testBundle(4);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ bundle })
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getActivePolicyBundleStatus({ force: true })).resolves.toMatchObject({
      state: "local_fallback",
      fallbackActive: true
    });
    await expect(getActivePolicyBundleStatus({ force: true })).resolves.toMatchObject({
      state: "organization_synced",
      bundleId: "bundle_4",
      fallbackActive: false,
      lastSuccessfulSyncAt: "2026-08-21T00:00:00.000Z"
    });
  });

  test("does not fetch organization policy while signed out and reports local fallback", async () => {
    auth.snapshot.mockResolvedValue({ status: "signed_out", localProtection: true, updatedAt: "2026-08-21T00:00:00.000Z" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const status = await getActivePolicyBundleStatus({ force: true });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(status).toMatchObject({
      state: "local_fallback",
      bundleId: LOCAL_FALLBACK_POLICY_BUNDLE_ID,
      organizationSpecificRulesAvailable: false,
      syncError: { category: "not_authenticated" }
    });
  });

  test("returns local fallback bundle for evaluation while signed out", async () => {
    auth.snapshot.mockResolvedValue({ status: "signed_out", localProtection: true, updatedAt: "2026-08-21T00:00:00.000Z" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const bundle = await getActivePolicyBundle({ force: true });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(bundle.id).toBe(LOCAL_FALLBACK_POLICY_BUNDLE_ID);
    expect(bundle.rules).toHaveLength(LOCAL_FALLBACK_POLICY_RULE_COUNT);
  });


  test("does not fetch organization policy without an active organization membership", async () => {
    auth.snapshot.mockResolvedValue({
      ...authenticatedSnapshot("org_1"),
      organization: null,
      membership: null,
      policy: { state: "local_fallback" }
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const status = await getActivePolicyBundleStatus({ force: true });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(status).toMatchObject({
      state: "local_fallback",
      syncError: { category: "no_organization" }
    });
  });

  test("does not reuse one organization's cached bundle for another organization", async () => {
    store["accordPolicyBundle:org_1"] = testBundle(1);
    auth.snapshot.mockResolvedValue(authenticatedSnapshot("org_2"));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

    await expect(getActivePolicyBundleStatus({ force: true })).resolves.toMatchObject({
      state: "local_fallback",
      bundleId: LOCAL_FALLBACK_POLICY_BUNDLE_ID
    });
  });
});

function authenticatedSnapshot(organizationId: string) {
  return {
    status: "authenticated" as const,
    localProtection: true as const,
    updatedAt: "2026-08-21T00:00:00.000Z",
    user: { id: "user_1", email: "member@example.com", displayName: "Accord Member" },
    organization: { id: organizationId, slug: "test-company", name: "Test Company" },
    membership: { id: "membership_1", role: "member" as const, status: "active" as const },
    policy: { state: "organization_synced" as const }
  };
}

function testBundle(version: number): PublishedPolicyBundle {
  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: `bundle_${version}`,
    companySlug: "test-company",
    version,
    status: "published",
    checksum: `checksum_${version}`,
    ruleCount: 0,
    publishedAt: "2026-07-28T00:00:00.000Z",
    enabledBuiltInBundleIds: [],
    approvedProviders: [],
    rules: []
  };
}
