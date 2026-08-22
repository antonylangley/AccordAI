import { describe, expect, test } from "vitest";
import { popupViewForState } from "./view-model";
import type { GuardAuthSnapshot } from "../auth/types";

const base = { localProtection: true as const, updatedAt: "2026-08-21T00:00:00.000Z" };

describe("Accord Guard popup states", () => {
  test.each([
    ["loading", "loading"],
    ["signed_out", "signed_out"],
    ["connecting", "connecting"]
  ] as const)("renders %s state", (status, kind) => expect(popupViewForState({ ...base, status }).kind).toBe(kind));

  test("renders authenticated organization state", () => {
    const state: GuardAuthSnapshot = {
      ...base, status: "authenticated",
      user: { id: "user", email: "member@example.test", displayName: "Member" },
      organization: { id: "org", slug: "org", name: "Organization" },
      membership: { id: "membership", role: "member", status: "active" },
      policy: { state: "synced", activeRuleCount: 7 }
    };
    expect(popupViewForState(state)).toEqual({ kind: "connected", title: "Protected", detail: "Organization policy synced" });
  });

  test("renders no-organization and recoverable error states", () => {
    const noOrg: GuardAuthSnapshot = { ...base, status: "authenticated", user: { id: "user", email: "member@example.test", displayName: "Member" }, organization: null, membership: null, policy: { state: "none" } };
    const error: GuardAuthSnapshot = { ...base, status: "error", code: "offline", message: "Sync unavailable.", recoverable: true };
    expect(popupViewForState(noOrg).kind).toBe("no_organization");
    expect(popupViewForState(error)).toMatchObject({ kind: "error", detail: "Sync unavailable." });
  });

  test("renders an expired session as a recoverable account-sync error", () => {
    const expired: GuardAuthSnapshot = {
      ...base,
      status: "error",
      code: "session_expired",
      message: "Your Accord session expired. Reconnect to sync organization policies.",
      recoverable: true
    };

    expect(popupViewForState(expired)).toEqual({
      kind: "error",
      title: "Account sync needs attention",
      detail: "Your Accord session expired. Reconnect to sync organization policies."
    });
  });
});
