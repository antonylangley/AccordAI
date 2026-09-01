import { describe, expect, test } from "vitest";
import { pauseControlViewForState, policyStatusView, popupViewForState } from "./view-model";
import type { GuardAuthSnapshot, GuardRole } from "../auth/types";

const base = { localProtection: true as const, updatedAt: "2026-08-21T00:00:00.000Z" };

describe("Accord Guard popup states", () => {
  test.each([
    ["loading", "loading"],
    ["signed_out", "signed_out"],
    ["connecting", "connecting"]
  ] as const)("renders %s state", (status, kind) => expect(popupViewForState({ ...base, status }).kind).toBe(kind));

  test("renders active organization policy state", () => {
    const state: GuardAuthSnapshot = {
      ...base,
      status: "authenticated",
      user: { id: "user", email: "member@example.test", displayName: "Member" },
      organization: { id: "org", slug: "org", name: "Organization" },
      membership: { id: "membership", role: "member", status: "active" },
      policy: {
        state: "organization_synced",
        sourceType: "organization",
        bundleId: "bundle_7",
        version: 7,
        activeRuleCount: 9,
        lastSuccessfulSyncAt: "2026-08-21T00:00:00.000Z",
        fallbackActive: false,
        organizationSpecificRulesAvailable: true
      }
    };

    expect(popupViewForState(state)).toMatchObject({
      kind: "connected",
      title: "Protected",
      detail: "Organization policy active",
      policy: {
        state: "organization_synced",
        title: "Organization policy active",
        tone: "protected",
        organizationSpecificRulesAvailable: true
      }
    });
  });

  test("renders cached organization policy as degraded but still organization-specific", () => {
    expect(
      policyStatusView({
        state: "organization_cached",
        sourceType: "organization_cache",
        bundleId: "bundle_3",
        version: 3,
        activeRuleCount: 7,
        fallbackActive: false,
        organizationSpecificRulesAvailable: true,
        syncError: {
          category: "request",
          occurredAt: "2026-08-21T00:00:00.000Z",
          recoverable: true
        }
      })
    ).toMatchObject({
      state: "organization_cached",
      title: "Organization policy cached",
      tone: "degraded",
      canRetry: true,
      organizationSpecificRulesAvailable: true
    });
  });

  test("renders local fallback without implying organization policy is active", () => {
    expect(
      policyStatusView({
        state: "local_fallback",
        sourceType: "local_fallback",
        bundleId: "accord.local-builtins",
        version: 1,
        activeRuleCount: 11,
        fallbackActive: true,
        organizationSpecificRulesAvailable: false
      })
    ).toMatchObject({
      state: "local_fallback",
      title: "Local protection active",
      detail: "Organization policy sync is unavailable. Built-in protections remain active; organization-specific rules may not be available.",
      tone: "degraded",
      canRetry: true,
      organizationSpecificRulesAvailable: false
    });
  });

  test("renders no-organization and recoverable error states", () => {
    const noOrg: GuardAuthSnapshot = {
      ...base,
      status: "authenticated",
      user: { id: "user", email: "member@example.test", displayName: "Member" },
      organization: null,
      membership: null,
      policy: { state: "local_fallback" }
    };
    const error: GuardAuthSnapshot = {
      ...base,
      status: "error",
      code: "offline",
      message: "Sync unavailable.",
      recoverable: true
    };
    expect(popupViewForState(noOrg)).toMatchObject({
      kind: "no_organization",
      policy: { title: "Local protection active" }
    });
    expect(popupViewForState(error)).toMatchObject({
      kind: "error",
      detail: "Sync unavailable.",
      policy: { title: "Local protection active" }
    });
  });

  test("renders an expired session as a recoverable account-sync error", () => {
    const expired: GuardAuthSnapshot = {
      ...base,
      status: "error",
      code: "session_expired",
      message: "Your Accord session expired. Reconnect to sync organization policies.",
      recoverable: true
    };

    expect(popupViewForState(expired)).toMatchObject({
      kind: "error",
      title: "Account sync needs attention",
      detail: "Your Accord session expired. Reconnect to sync organization policies.",
      policy: { title: "Local protection active" }
    });
  });

  test("shows the pause control only for owners", () => {
    const owner = authenticatedState("owner");
    expect(pauseControlViewForState(owner, enforcementState(true))).toMatchObject({
      visible: true,
      paused: false,
      title: "Guard active",
      stateLabel: "ON",
      actionLabel: "Pause Guard"
    });
    expect(pauseControlViewForState(owner, enforcementState(false))).toMatchObject({
      visible: true,
      paused: true,
      title: "Guard paused",
      stateLabel: "OFF",
      actionLabel: "Resume Guard"
    });
  });

  test.each(["admin", "member", "viewer"] satisfies GuardRole[])(
    "hides the pause control for %s",
    (role) => {
      expect(pauseControlViewForState(authenticatedState(role), enforcementState(true))).toEqual({ visible: false });
    }
  );

  test("hides the pause control for signed-out and no-organization states", () => {
    expect(pauseControlViewForState({ ...base, status: "signed_out" }, enforcementState(true))).toEqual({ visible: false });
    expect(
      pauseControlViewForState(
        {
          ...authenticatedState("owner"),
          organization: null,
          membership: null
        },
        enforcementState(true)
      )
    ).toEqual({ visible: false });
  });
});

function authenticatedState(role: GuardRole): Extract<GuardAuthSnapshot, { status: "authenticated" }> {
  return {
    ...base,
    status: "authenticated",
    user: { id: "user", email: "user@example.test", displayName: "User" },
    organization: { id: "org", slug: "org", name: "Organization" },
    membership: { id: "membership", role, status: "active" },
    policy: {
      state: "organization_synced",
      sourceType: "organization",
      bundleId: "bundle_1",
      version: 1,
      activeRuleCount: 3,
      fallbackActive: false,
      organizationSpecificRulesAvailable: true
    }
  };
}

function enforcementState(enabled: boolean) {
  return {
    enabled,
    paused: !enabled,
    canPause: true,
    reason: enabled ? "active" : "owner_paused",
    updatedAt: "2026-08-31T00:00:00.000Z",
    scope: { userId: "user", organizationId: "org", role: "owner" }
  } as const;
}
