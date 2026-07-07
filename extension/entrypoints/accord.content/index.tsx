import React from "react";
import { createRoot } from "react-dom/client";
import { defineContentScript } from "wxt/utils/define-content-script";
import "./style.css";
import { ChatGPTAdapter } from "../../src/adapters/chatgpt";
import type { SurfaceAssistantResponse } from "../../src/adapters/types";
import { rehydrateTextNodes } from "../../src/governance/response-rehydration";
import type { SafeScanResult } from "../../src/messaging/types";
import { sendGuardMessage } from "../../src/messaging/client";
import { runFinalSubmissionDecision, TrustedSubmissionGate } from "../../src/state/final-submission";
import { createSurfaceState } from "../../src/state/surface-state";
import { AccordIndicator } from "../../src/ui/AccordIndicator";

export default defineContentScript({
  matches: ["https://chatgpt.com/*"],
  runAt: "document_idle",
  main(ctx) {
    const adapter = new ChatGPTAdapter();

    if (!adapter.isCurrentSurface()) {
      return;
    }

    console.info("[Accord Guard] adapter attached");

    const rootElement = document.createElement("div");
    rootElement.id = "accord-guard-root";
    document.documentElement.append(rootElement);

    const state = createSurfaceState();
    const root = createRoot(rootElement);
    const render = () => {
      root.render(
        <AccordIndicator
          state={state.getSnapshot()}
          onWhy={() => {
            state.set({ whyOpen: !state.getSnapshot().whyOpen });
            render();
          }}
        />
      );
    };

    render();
    state.subscribe(render);

    const trustedGate = new TrustedSubmissionGate();
    const scanSeq = { current: 0 };
    let liveScanTimer: number | undefined;
    let conversationKey = adapter.getConversationKey();

    const syncConversationKey = async () => {
      const nextKey = adapter.getConversationKey();
      if (nextKey !== conversationKey) {
        if (conversationKey.startsWith("draft:") && nextKey.startsWith("conversation:")) {
          await sendGuardMessage({
            type: "accord.moveVault",
            payload: {
              surface: "chatgpt",
              fromConversationKey: conversationKey,
              toConversationKey: nextKey
            }
          });
        }
        conversationKey = nextKey;
      }
    };

    const runLiveScan = (text: string) => {
      window.clearTimeout(liveScanTimer);

      if (!text.trim()) {
        state.set({ phase: "idle", scan: undefined, message: undefined });
        adapter.setComposerDecoratedState("clear");
        return;
      }

      state.set({ phase: "scanning", message: undefined });
      adapter.setComposerDecoratedState("scanning");

      liveScanTimer = window.setTimeout(() => {
        const sequence = ++scanSeq.current;
        void syncConversationKey()
          .then(() =>
            sendGuardMessage({
              type: "accord.scanDraft",
              payload: {
                surface: "chatgpt",
                conversationKey,
                text,
                sensitivity: "Internal",
                authoritative: false,
                includeSanitizedText: false
              }
            })
          )
          .then((response) => {
            if (!response.ok || response.result == null || !("action" in response.result) || sequence !== scanSeq.current) return;
            applyScanState(response.result);
          })
          .catch(() => {
            state.set({ phase: "failed", message: "Accord scan unavailable." });
            adapter.setComposerDecoratedState("failed");
          });
      }, 300);
    };

    const applyScanState = (scan: SafeScanResult) => {
      if (scan.action === "block") {
        state.set({ phase: "blocked", scan, message: scan.explanation });
        adapter.setComposerDecoratedState("blocked");
      } else if (scan.action === "redact") {
        state.set({ phase: "redact", scan, message: scan.explanation });
        adapter.setComposerDecoratedState("redact");
      } else {
        state.set({ phase: "clear", scan, message: undefined });
        adapter.setComposerDecoratedState("clear");
      }
    };

    const unsubscribeDraft = adapter.subscribeToDraft(runLiveScan);
    const unsubscribeSubmit = adapter.subscribeToSubmit((submission) => {
      if (trustedGate.consumeIfAuthorized()) {
        return;
      }

      submission.prevent();
      state.set({ phase: "scanning", message: "Running final Accord scan..." });
      adapter.setComposerDecoratedState("scanning");

      void syncConversationKey()
        .then(() =>
          runFinalSubmissionDecision({
            readDraft: () => adapter.getDraftText(),
            scan: (text) =>
              sendGuardMessage({
                type: "accord.scanDraft",
                payload: {
                  surface: "chatgpt",
                  conversationKey,
                  text,
                  sensitivity: "Internal",
                  authoritative: true,
                  includeSanitizedText: true
                }
              }).then((response) => {
                if (!response.ok) {
                  throw new Error(response.error);
                }
                if (!response.result || !("action" in response.result)) {
                  throw new Error("Accord final scan failed.");
                }
                return response.result;
              }),
            setDraftText: (text) => adapter.setDraftText(text),
            verifyDraftText: () => adapter.getDraftText(),
            submitTrusted: async () => {
              trustedGate.authorizeNext();
              await adapter.submit();
            },
            onState: (nextState) => {
              state.set(nextState);
              if (nextState.phase) {
                adapter.setComposerDecoratedState(nextState.phase);
              }
            }
          })
        )
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Accord could not complete the final scan.";
          state.set({ phase: "failed", message });
          adapter.setComposerDecoratedState("failed");
        });
    });

    const unsubscribeResponses = adapter.subscribeToAssistantResponses((response) => {
      void syncConversationKey().then(() => rehydrateResponse(response));
    });

    const rehydrateResponse = (response: SurfaceAssistantResponse) => {
      void rehydrateTextNodes(response.element, (text) =>
        sendGuardMessage({
          type: "accord.rehydrateResponse",
          payload: {
            surface: "chatgpt",
            conversationKey,
            text
          }
        }).then((message) => (message.ok && message.result && "text" in message.result ? message.result.text : text))
      );
    };

    const unsubscribeRoute = adapter.subscribeToRouteChanges(() => {
      void syncConversationKey();
    });

    const attachmentTimer = window.setInterval(() => {
      state.set({ attachmentNotice: adapter.hasAttachments() });
    }, 1500);

    ctx.addEventListener(window, "beforeunload", () => {
      window.clearTimeout(liveScanTimer);
      window.clearInterval(attachmentTimer);
      unsubscribeDraft();
      unsubscribeSubmit();
      unsubscribeResponses();
      unsubscribeRoute();
      root.unmount();
      rootElement.remove();
    });
  }
});
