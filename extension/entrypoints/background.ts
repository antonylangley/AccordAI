import { defineBackground } from "wxt/utils/define-background";
import { governAttachmentBatch, moveVault, rehydrateAssistantText, scanDraft } from "../src/governance/scan-session";
import type { AccordGuardMessage, AccordGuardResponse } from "../src/messaging/types";

export default defineBackground(() => {
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
    default:
      return { ok: false, error: "Unknown Accord Guard message." };
  }
}
