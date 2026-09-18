import { defineBackground } from "wxt/utils/define-background";
import { handleAccordGuardMessage } from "../src/background/message-handler";
import type { AccordGuardMessage, AccordGuardResponse } from "../src/messaging/types";
import { warmPersonDetector } from "../src/person-detection/person-detector";
import { getGuardAuthSnapshot, markGuardPolicySync } from "../src/auth/session";
import { getActivePolicyBundleStatus, policyStatusToGuardSync } from "../src/policy/bundle-client";
import { configureSidePanelAction } from "../src/sidepanel/action";

export default defineBackground(() => {
  void configureSidePanelAction().catch(() => undefined);

  // Warm the packaged NER model when the MV3 service worker starts. Failure is
  // non-fatal; PERSON detection fails closed with no deterministic fallback.
  void warmPersonDetector().catch(() => undefined);
  void getGuardAuthSnapshot({ force: true }).then((snapshot) => {
    if (snapshot.status === "authenticated") void syncOrganizationPolicy();
  });

  chrome.runtime.onMessage.addListener((message: AccordGuardMessage, _sender, sendResponse) => {
    if (!message || typeof message !== "object" || !("type" in message) || !message.type.startsWith("accord.")) {
      return false;
    }

    void handleAccordGuardMessage(message)
      .then((response) => sendResponse(response))
      .catch((error: unknown) => {
        const messageText = error instanceof Error ? error.message : "Accord Guard request failed.";
        sendResponse({ ok: false, error: messageText } satisfies AccordGuardResponse);
      });

    return true;
  });
});

async function syncOrganizationPolicy() {
  const status = await getActivePolicyBundleStatus({ force: true });
  await markGuardPolicySync(policyStatusToGuardSync(status));
}
