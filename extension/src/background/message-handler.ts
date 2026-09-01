import { connectGuardAccount, disconnectGuardAccount, getGuardAuthSnapshot, markGuardPolicySync } from "../auth/session";
import { governAttachmentBatch, moveVault, rehydrateAssistantText, scanDraft } from "../governance/scan-session";
import type {
  AccordGuardMessage,
  AccordGuardResponse,
  GuardEnforcementChangedMessage
} from "../messaging/types";
import { getActivePolicyBundleStatus, policyStatusToGuardSync } from "../policy/bundle-client";
import { getGuardEnforcementState, pausedScanResult, setGuardEnforcementPaused } from "../state/enforcement-state";
import { recordGuardTelemetry } from "../telemetry/client";

type HandlerDependencies = {
  scanDraft: typeof scanDraft;
  governAttachmentBatch: typeof governAttachmentBatch;
  rehydrateAssistantText: typeof rehydrateAssistantText;
  moveVault: typeof moveVault;
  recordGuardTelemetry: typeof recordGuardTelemetry;
  connectGuardAccount: typeof connectGuardAccount;
  disconnectGuardAccount: typeof disconnectGuardAccount;
  getGuardAuthSnapshot: typeof getGuardAuthSnapshot;
  markGuardPolicySync: typeof markGuardPolicySync;
  getActivePolicyBundleStatus: typeof getActivePolicyBundleStatus;
  getGuardEnforcementState: typeof getGuardEnforcementState;
  setGuardEnforcementPaused: typeof setGuardEnforcementPaused;
  notifyEnforcementChanged?: (message: GuardEnforcementChangedMessage) => void | Promise<void>;
};

const defaultDependencies: HandlerDependencies = {
  scanDraft,
  governAttachmentBatch,
  rehydrateAssistantText,
  moveVault,
  recordGuardTelemetry,
  connectGuardAccount,
  disconnectGuardAccount,
  getGuardAuthSnapshot,
  markGuardPolicySync,
  getActivePolicyBundleStatus,
  getGuardEnforcementState,
  setGuardEnforcementPaused,
  notifyEnforcementChanged
};

export function createAccordGuardMessageHandler(dependencies: Partial<HandlerDependencies> = {}) {
  const deps = { ...defaultDependencies, ...dependencies };

  async function syncOrganizationPolicy() {
    const status = await deps.getActivePolicyBundleStatus({ force: true });
    await deps.markGuardPolicySync(policyStatusToGuardSync(status));
  }

  return async function handleMessage(message: AccordGuardMessage): Promise<AccordGuardResponse> {
    switch (message.type) {
      case "accord.scanDraft": {
        const enforcement = await deps.getGuardEnforcementState({ requireFreshRole: true });
        return {
          ok: true,
          result: enforcement.enabled ? await deps.scanDraft(message.payload) : pausedScanResult(message.payload)
        };
      }
      case "accord.governAttachments":
        return {
          ok: true,
          result: await deps.governAttachmentBatch(message.payload)
        };
      case "accord.rehydrateResponse":
        return {
          ok: true,
          result: await deps.rehydrateAssistantText(message.payload)
        };
      case "accord.moveVault":
        await deps.moveVault(message.payload);
        return { ok: true };
      case "accord.recordTelemetry":
        await deps.recordGuardTelemetry(message.payload);
        return { ok: true };
      case "accord.auth.getState":
        return { ok: true, result: await deps.getGuardAuthSnapshot({ force: message.payload?.force }) };
      case "accord.auth.connect": {
        const result = await deps.connectGuardAccount(message.payload.provider);
        if (result.status === "authenticated") await syncOrganizationPolicy();
        return { ok: true, result: await deps.getGuardAuthSnapshot() };
      }
      case "accord.auth.signOut":
        return { ok: true, result: await deps.disconnectGuardAccount() };
      case "accord.policy.sync":
        await syncOrganizationPolicy();
        return { ok: true, result: await deps.getGuardAuthSnapshot() };
      case "accord.enforcement.getState":
        return {
          ok: true,
          result: await deps.getGuardEnforcementState({
            forceAuth: message.payload?.force,
            requireFreshRole: message.payload?.force
          })
        };
      case "accord.enforcement.setPaused": {
        const result = await deps.setGuardEnforcementPaused(message.payload.paused);
        await deps.notifyEnforcementChanged?.({ type: "accord.enforcement.changed", payload: result });
        return { ok: true, result };
      }
      default:
        return { ok: false, error: "Unknown Accord Guard message." };
    }
  };
}

export const handleAccordGuardMessage = createAccordGuardMessageHandler();

function notifyEnforcementChanged(message: GuardEnforcementChangedMessage) {
  const tabs = globalThis.chrome?.tabs;
  if (!tabs?.query || !tabs.sendMessage) return;

  tabs.query({ url: "https://chatgpt.com/*" }, (items) => {
    for (const tab of items) {
      if (typeof tab.id !== "number") continue;
      tabs.sendMessage(tab.id, message, () => {
        void chrome.runtime.lastError;
      });
    }
  });
}
