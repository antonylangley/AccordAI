import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { GuardAuthSnapshot, GuardPolicySyncError, GuardRole } from "../auth/types";
import {
  getGuardEnforcementState,
  pausedScanResult,
  setGuardEnforcementPaused
} from "./enforcement-state";

const auth = vi.hoisted(() => ({
  snapshot: vi.fn()
}));

vi.mock("../auth/session", () => ({
  getGuardAuthSnapshot: auth.snapshot
}));

const store: Record<string, unknown> = {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-31T00:00:00.000Z"));
  vi.clearAllMocks();
  auth.snapshot.mockResolvedValue(ownerSnapshot());
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
        },
        remove(keys: string | string[], callback?: () => void) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete store[key];
          }
          callback?.();
        }
      }
    }
  } as unknown as typeof chrome;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Guard owner pause state", () => {
  test("defaults to active for an owner and exposes pause eligibility", async () => {
    await expect(getGuardEnforcementState()).resolves.toMatchObject({
      enabled: true,
      paused: false,
      canPause: true,
      reason: "active",
      scope: {
        userId: "owner_1",
        organizationId: "org_1",
        role: "owner"
      }
    });
  });

  test("owner pause disables enforcement, survives storage reload, and resumes", async () => {
    await expect(setGuardEnforcementPaused(true)).resolves.toMatchObject({
      enabled: false,
      paused: true,
      reason: "owner_paused"
    });
    await expect(getGuardEnforcementState()).resolves.toMatchObject({
      enabled: false,
      paused: true,
      reason: "owner_paused"
    });

    await expect(setGuardEnforcementPaused(false)).resolves.toMatchObject({
      enabled: true,
      paused: false,
      reason: "active"
    });
  });

  test("signed-out and no-organization states do not inherit an owner pause", async () => {
    await setGuardEnforcementPaused(true);

    auth.snapshot.mockResolvedValue({ status: "signed_out", localProtection: true, updatedAt: "2026-08-31T00:00:00.000Z" });
    await expect(getGuardEnforcementState()).resolves.toMatchObject({
      enabled: true,
      paused: false,
      canPause: false,
      reason: "signed_out"
    });

    auth.snapshot.mockResolvedValue({ ...ownerSnapshot(), organization: null, membership: null });
    await expect(getGuardEnforcementState()).resolves.toMatchObject({
      enabled: true,
      paused: false,
      canPause: false,
      reason: "no_organization"
    });
  });

  test.each(["admin", "member", "viewer"] satisfies GuardRole[])(
    "%s role cannot use or inherit a pause",
    async (role) => {
      await setGuardEnforcementPaused(true);
      auth.snapshot.mockResolvedValue(ownerSnapshot({ role }));

      await expect(getGuardEnforcementState()).resolves.toMatchObject({
        enabled: true,
        paused: false,
        canPause: false,
        reason: "not_owner"
      });
    }
  );

  test("pause is scoped by organization and user", async () => {
    await setGuardEnforcementPaused(true);

    auth.snapshot.mockResolvedValue(ownerSnapshot({ organizationId: "org_2" }));
    await expect(getGuardEnforcementState()).resolves.toMatchObject({
      enabled: true,
      paused: false,
      canPause: true,
      reason: "active",
      scope: { organizationId: "org_2", userId: "owner_1" }
    });

    auth.snapshot.mockResolvedValue(ownerSnapshot({ userId: "owner_2" }));
    await expect(getGuardEnforcementState()).resolves.toMatchObject({
      enabled: true,
      paused: false,
      canPause: true,
      reason: "active",
      scope: { organizationId: "org_1", userId: "owner_2" }
    });
  });

  test("fresh role failures fail safe to active even when a stale pause exists", async () => {
    await setGuardEnforcementPaused(true);
    auth.snapshot.mockResolvedValue(
      ownerSnapshot({
        syncErrorCategory: "account_sync_unavailable"
      })
    );

    await expect(getGuardEnforcementState({ requireFreshRole: true })).resolves.toMatchObject({
      enabled: true,
      paused: false,
      canPause: false,
      reason: "role_unresolved"
    });
  });

  test("unknown/bootstrap error state fails safe to active", async () => {
    await setGuardEnforcementPaused(true);
    auth.snapshot.mockResolvedValue({
      status: "error",
      localProtection: true,
      updatedAt: "2026-08-31T00:00:00.000Z",
      code: "sync_unavailable",
      message: "Account sync is temporarily unavailable.",
      recoverable: true
    } satisfies GuardAuthSnapshot);

    await expect(getGuardEnforcementState()).resolves.toMatchObject({
      enabled: true,
      paused: false,
      canPause: false,
      reason: "role_unresolved"
    });
  });

  test("paused scan result allows without returning raw prompt content", () => {
    const result = pausedScanResult({
      surface: "chatgpt",
      conversationKey: "conversation:test",
      text: "Draft an email to John Smith.",
      sensitivity: "Internal",
      authoritative: true,
      includeSanitizedText: true
    });

    expect(result).toMatchObject({
      action: "allow",
      riskScore: 0,
      detectedEntityCount: 0,
      decorations: [],
      flags: [],
      personDetection: {
        nerStatus: "unavailable",
        detector: "enforcement-paused"
      }
    });
    expect(result).not.toHaveProperty("sanitizedText");
  });
});

function ownerSnapshot({
  userId = "owner_1",
  organizationId = "org_1",
  role = "owner",
  syncErrorCategory
}: {
  userId?: string;
  organizationId?: string;
  role?: GuardRole;
  syncErrorCategory?: GuardPolicySyncError["category"];
} = {}): Extract<GuardAuthSnapshot, { status: "authenticated" }> {
  return {
    status: "authenticated",
    localProtection: true,
    updatedAt: "2026-08-31T00:00:00.000Z",
    user: { id: userId, email: `${userId}@example.test`, displayName: "Owner User" },
    organization: { id: organizationId, slug: organizationId, name: "Test Company" },
    membership: { id: `membership_${userId}`, role, status: "active" },
    policy: {
      state: syncErrorCategory ? "organization_cached" : "organization_synced",
      sourceType: syncErrorCategory ? "organization_cache" : "organization",
      bundleId: "bundle_1",
      version: 1,
      activeRuleCount: 3,
      fallbackActive: false,
      organizationSpecificRulesAvailable: true,
      syncError: syncErrorCategory
        ? {
            category: syncErrorCategory,
            occurredAt: "2026-08-31T00:00:00.000Z",
            recoverable: true
          }
        : undefined
    }
  };
}
