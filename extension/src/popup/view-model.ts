import type { GuardAuthSnapshot, GuardEnforcementState, GuardPolicySync } from "../auth/types";

export type GuardPolicyStatusView = {
  state: "organization_synced" | "organization_cached" | "local_fallback" | "syncing";
  title: string;
  detail: string;
  tone: "protected" | "degraded" | "neutral";
  canRetry: boolean;
  organizationSpecificRulesAvailable: boolean;
};

export type GuardPopupView =
  | { kind: "loading"; title: string; detail: string }
  | { kind: "signed_out"; title: string; detail: string; policy: GuardPolicyStatusView }
  | { kind: "connecting"; title: string; detail: string }
  | { kind: "no_organization"; title: string; detail: string; policy: GuardPolicyStatusView }
  | { kind: "connected"; title: string; detail: string; policy: GuardPolicyStatusView }
  | { kind: "error"; title: string; detail: string; policy: GuardPolicyStatusView };

export type GuardPauseControlView =
  | { visible: false }
  | {
      visible: true;
      paused: boolean;
      locked: boolean;
      title: string;
      detail: string;
      stateLabel: string;
      actionLabel: string;
    };

export function popupViewForState(state: GuardAuthSnapshot): GuardPopupView {
  switch (state.status) {
    case "loading":
      return { kind: "loading", title: "Loading Accord Guard…", detail: "Local protection remains active." };
    case "connecting":
      return { kind: "connecting", title: "Connecting to Accord…", detail: "Complete sign-in in the browser window." };
    case "signed_out":
      return {
        kind: "signed_out",
        title: "Protect your work with Accord",
        detail: "Connect your Accord account to apply your organization’s AI policies.",
        policy: localFallbackView()
      };
    case "error":
      return {
        kind: "error",
        title: "Account sync needs attention",
        detail: state.message,
        policy: localFallbackView()
      };
    case "authenticated":
      if (!state.organization || !state.membership) {
        return {
          kind: "no_organization",
          title: "Account connected",
          detail: "You aren’t part of an Accord organization yet.",
          policy: localFallbackView()
        };
      }

      return {
        kind: "connected",
        title: "Protected",
        detail: policyStatusView(state.policy).title,
        policy: policyStatusView(state.policy)
      };
  }
}

export function pauseControlViewForState(
  state: GuardAuthSnapshot,
  enforcement: GuardEnforcementState | null
): GuardPauseControlView {
  if (state.status !== "authenticated" || !state.organization || !state.membership) {
    return { visible: false };
  }

  if (state.membership.role !== "owner") {
    return {
      visible: true,
      paused: false,
      locked: true,
      title: "Guard active",
      detail: "Your organization requires Guard to stay active on this browser.",
      stateLabel: "ON",
      actionLabel: "Guard is managed by your organization"
    };
  }

  if (enforcement?.paused) {
    return {
      visible: true,
      paused: true,
      locked: false,
      title: "Guard paused",
      detail: "Accord is not currently enforcing AI policy in this browser.",
      stateLabel: "OFF",
      actionLabel: "Resume Guard"
    };
  }

  return {
    visible: true,
    paused: false,
    locked: false,
    title: "Guard active",
    detail: "Accord is enforcing AI policy in this browser.",
    stateLabel: "ON",
    actionLabel: "Pause Guard"
  };
}

export function policyStatusView(policy: GuardPolicySync): GuardPolicyStatusView {
  const state = normalizedPolicyState(policy);

  if (state === "organization_synced") {
    return {
      state,
      title: "Organization policy active",
      detail: "Organization-specific rules are active in Guard.",
      tone: "protected",
      canRetry: false,
      organizationSpecificRulesAvailable: true
    };
  }

  if (state === "organization_cached") {
    return {
      state,
      title: "Organization policy cached",
      detail: "Using the last synchronized organization policy. Sync is currently degraded.",
      tone: "degraded",
      canRetry: true,
      organizationSpecificRulesAvailable: true
    };
  }

  if (state === "syncing") {
    return {
      state,
      title: "Syncing organization policy",
      detail: "Local protection remains active while Guard checks for organization rules.",
      tone: "neutral",
      canRetry: false,
      organizationSpecificRulesAvailable: false
    };
  }

  return localFallbackView();
}

function localFallbackView(): GuardPolicyStatusView {
  return {
    state: "local_fallback",
    title: "Local protection active",
    detail: "Organization policy sync is unavailable. Built-in protections remain active; organization-specific rules may not be available.",
    tone: "degraded",
    canRetry: true,
    organizationSpecificRulesAvailable: false
  };
}

function normalizedPolicyState(policy: GuardPolicySync): GuardPolicyStatusView["state"] {
  if (policy.state === "organization_synced" || policy.state === "synced") return "organization_synced";
  if (policy.state === "organization_cached" || policy.state === "offline") {
    return policy.bundleId ? "organization_cached" : "local_fallback";
  }
  if (policy.state === "syncing") return "syncing";
  return "local_fallback";
}
