import type { GuardAuthSnapshot } from "../auth/types";

export type GuardPopupView =
  | { kind: "loading"; title: string; detail: string }
  | { kind: "signed_out"; title: string; detail: string }
  | { kind: "connecting"; title: string; detail: string }
  | { kind: "no_organization"; title: string; detail: string }
  | { kind: "connected"; title: string; detail: string }
  | { kind: "error"; title: string; detail: string };

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
        detail: "Connect your Accord account to apply your organization’s AI policies."
      };
    case "error":
      return { kind: "error", title: "Account sync needs attention", detail: state.message };
    case "authenticated":
      if (!state.organization || !state.membership) {
        return {
          kind: "no_organization",
          title: "Account connected",
          detail: "You aren’t part of an Accord organization yet."
        };
      }
      return {
        kind: "connected",
        title: "Protected",
        detail: state.policy.state === "synced" ? "Organization policy synced" : "Local protection active"
      };
  }
}
