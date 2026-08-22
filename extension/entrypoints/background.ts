import { defineBackground } from "wxt/utils/define-background";
import { governAttachmentBatch, moveVault, rehydrateAssistantText, scanDraft } from "../src/governance/scan-session";
import type { AccordGuardMessage, AccordGuardResponse } from "../src/messaging/types";
import { warmPersonDetector } from "../src/person-detection/person-detector";
import { recordGuardTelemetry } from "../src/telemetry/client";
import {
  connectGuardAccount,
  disconnectGuardAccount,
  getGuardAuthSnapshot,
  markGuardPolicySync
} from "../src/auth/session";
import { getActivePolicyBundle } from "../src/policy/bundle-client";

export default defineBackground(() => {
  // Warm the packaged NER model when the MV3 service worker starts. Failure is
  // non-fatal; PERSON detection fails closed with no deterministic fallback.
  void warmPersonDetector().catch(() => undefined);
  void getGuardAuthSnapshot({ force: true }).then((snapshot) => {
    if (snapshot.status === "authenticated" && snapshot.organization) void syncOrganizationPolicy();
  });

  chrome.runtime.onMessage.addListener((message: AccordGuardMessage, _sender, sendResponse) => {
    if (!message || typeof message !== "object" || !("type" in message) || !message.type.startsWith("accord.")) {
      return false;
    }

    void handleMessage(message)
      .then((response) => sendResponse(response))
      .catch((error: unknown) => {
        const messageText = error instanceof Error ? error.message : "Accord Guard request failed.";
        sendResponse({ ok: false, error: messageText } satisfies AccordGuardResponse);
      });

    return true;
  });
});

async function handleMessage(message: AccordGuardMessage): Promise<AccordGuardResponse> {
  switch (message.type) {
    case "accord.scanDraft":
      return {
        ok: true,
        result: await scanDraft(message.payload)
      };
    case "accord.governAttachments":
      return {
        ok: true,
        result: await governAttachmentBatch(message.payload)
      };
    case "accord.rehydrateResponse":
      return {
        ok: true,
        result: await rehydrateAssistantText(message.payload)
      };
    case "accord.moveVault":
      await moveVault(message.payload);
      return { ok: true };
    case "accord.recordTelemetry":
      await recordGuardTelemetry(message.payload);
      return { ok: true };
    case "accord.auth.getState":
      return { ok: true, result: await getGuardAuthSnapshot({ force: message.payload?.force }) };
    case "accord.auth.connect": {
      const result = await connectGuardAccount(message.payload.provider);
      if (result.status === "authenticated" && result.organization) await syncOrganizationPolicy();
      return { ok: true, result: await getGuardAuthSnapshot() };
    }
    case "accord.auth.signOut":
      return { ok: true, result: await disconnectGuardAccount() };
    case "accord.policy.sync":
      await syncOrganizationPolicy();
      return { ok: true, result: await getGuardAuthSnapshot() };
    default:
      return { ok: false, error: "Unknown Accord Guard message." };
  }
}

async function syncOrganizationPolicy() {
  const bundle = await getActivePolicyBundle({ force: true });
  await markGuardPolicySync(
    bundle
      ? {
          state: "synced",
          bundleId: bundle.id,
          version: bundle.version,
          activeRuleCount: bundle.rules.length,
          lastPublishedAt: bundle.publishedAt,
          lastSyncedAt: new Date().toISOString()
        }
      : { state: "none", lastSyncedAt: new Date().toISOString() }
  );
}
