import { describe, expect, test } from "vitest";
import { isGuardAuthSnapshot } from "./session";

const authenticatedSnapshot = {
  status: "authenticated",
  localProtection: true,
  updatedAt: "2026-08-21T00:00:00.000Z",
  user: { id: "user_1", email: "member@example.com", displayName: "Accord Member", provider: "google" },
  organization: { id: "org_1", slug: "test-company", name: "Test Company" },
  membership: { id: "membership_1", role: "member", status: "active" },
  policy: {
    state: "organization_synced",
    sourceType: "organization",
    bundleId: "bundle_1",
    version: 4,
    activeRuleCount: 3,
    lastSuccessfulSyncAt: "2026-08-21T00:00:00.000Z",
    fallbackActive: false,
    organizationSpecificRulesAvailable: true
  }
};

describe("Guard public auth snapshot validation", () => {
  test("accepts signed-out and complete authenticated snapshots", () => {
    expect(
      isGuardAuthSnapshot({
        status: "signed_out",
        localProtection: true,
        updatedAt: "2026-08-21T00:00:00.000Z"
      })
    ).toBe(true);
    expect(isGuardAuthSnapshot(authenticatedSnapshot)).toBe(true);
  });

  test("accepts an authenticated account with no organization membership", () => {
    expect(
      isGuardAuthSnapshot({
        ...authenticatedSnapshot,
        organization: null,
        membership: null,
        policy: {
          state: "local_fallback",
          sourceType: "local_fallback",
          bundleId: "accord.local-builtins",
          version: 1,
          activeRuleCount: 11,
          fallbackActive: true,
          organizationSpecificRulesAvailable: false
        }
      })
    ).toBe(true);
  });

  test("accepts legacy policy sync states from existing installed snapshots", () => {
    expect(isGuardAuthSnapshot({ ...authenticatedSnapshot, policy: { state: "synced", version: 4 } })).toBe(true);
    expect(isGuardAuthSnapshot({ ...authenticatedSnapshot, policy: { state: "offline", bundleId: "bundle_1" } })).toBe(true);
  });

  test("rejects corrupt or incomplete cached account state", () => {
    expect(isGuardAuthSnapshot({ status: "authenticated", localProtection: true })).toBe(false);
    expect(isGuardAuthSnapshot({ ...authenticatedSnapshot, localProtection: false })).toBe(false);
    expect(isGuardAuthSnapshot({ ...authenticatedSnapshot, status: "unknown" })).toBe(false);
    expect(isGuardAuthSnapshot({ ...authenticatedSnapshot, membership: null })).toBe(false);
    expect(isGuardAuthSnapshot({ ...authenticatedSnapshot, policy: { state: "synced", version: "4" } })).toBe(false);
    expect(
      isGuardAuthSnapshot({
        ...authenticatedSnapshot,
        policy: {
          state: "local_fallback",
          syncError: { category: "request", recoverable: true }
        }
      })
    ).toBe(false);
  });

  test("requires structured recoverable error metadata", () => {
    expect(
      isGuardAuthSnapshot({
        status: "error",
        localProtection: true,
        updatedAt: "2026-08-21T00:00:00.000Z",
        code: "sync_unavailable",
        message: "Account sync is temporarily unavailable.",
        recoverable: true
      })
    ).toBe(true);
    expect(
      isGuardAuthSnapshot({
        status: "error",
        localProtection: true,
        updatedAt: "2026-08-21T00:00:00.000Z",
        message: "Missing code",
        recoverable: true
      })
    ).toBe(false);
  });
});
