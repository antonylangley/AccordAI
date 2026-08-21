import { beforeEach, describe, expect, test, vi } from "vitest";
import { POLICY_SCHEMA_VERSION } from "@accord/governance-core";
import { getActivePolicyBundle, resetPolicyBundleMemoryCacheForTests } from "./bundle-client";
import type { PublishedPolicyBundle } from "./types";

const store: Record<string, unknown> = {};

beforeEach(() => {
  resetPolicyBundleMemoryCacheForTests();
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
    expect(store["accordPolicyBundle:test-company"]).toEqual(bundle);
  });

  test("uses cached bundle when the policy endpoint is offline", async () => {
    store["accordPolicyBundle:test-company"] = testBundle(1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );

    const result = await getActivePolicyBundle();

    expect(result?.version).toBe(1);
  });
});

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
