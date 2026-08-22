import { beforeEach, describe, expect, test, vi } from "vitest";
import { POLICY_SCHEMA_VERSION } from "@accord/governance-core";
import { getActivePolicyBundle, resetPolicyBundleMemoryCacheForTests } from "./bundle-client";
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

describe("policy bundle client", () => {
  test("fetches and caches the latest published bundle", async () => {
    const bundle = testBundle(2);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ bundle })
      }))
    );

    const result = await getActivePolicyBundle();

    expect(result?.version).toBe(2);
    expect(store["accordPolicyBundle:org_1"]).toEqual(bundle);
    expect(fetch).toHaveBeenCalledWith(
      "https://www.accordgovernance.com/api/guard/policy-bundle",
      { cache: "no-store", headers: { Authorization: "Bearer test-access-token" } }
    );
  });

  test("rejects a legacy response and preserves a valid cached v2 bundle", async () => {
    const cached = testBundle(3);
    store["accordPolicyBundle:org_1"] = cached;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ bundle: { id: "legacy", version: 12, rules: [] } })
      }))
    );

    const result = await getActivePolicyBundle();

    expect(result).toEqual(cached);
  });

  test("uses cached bundle when the policy endpoint is offline", async () => {
    store["accordPolicyBundle:org_1"] = testBundle(1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );

    const result = await getActivePolicyBundle();

    expect(result?.version).toBe(1);
  });

  test("does not fetch organization policy while signed out", async () => {
    auth.snapshot.mockResolvedValue({ status: "signed_out", localProtection: true, updatedAt: "2026-08-21T00:00:00.000Z" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getActivePolicyBundle()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not fetch organization policy without an active organization membership", async () => {
    auth.snapshot.mockResolvedValue({
      ...authenticatedSnapshot("org_1"),
      organization: null,
      membership: null,
      policy: { state: "none" }
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getActivePolicyBundle()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not reuse one organization's cached bundle for another organization", async () => {
    store["accordPolicyBundle:org_1"] = testBundle(1);
    auth.snapshot.mockResolvedValue(authenticatedSnapshot("org_2"));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

    await expect(getActivePolicyBundle()).resolves.toBeNull();
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
    policy: { state: "synced" as const }
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
