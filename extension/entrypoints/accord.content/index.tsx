import React from "react";
import { createRoot } from "react-dom/client";
import { defineContentScript } from "wxt/utils/define-content-script";
import "./style.css";
import accordMarkUrl from "../../src/assets/accord-mark.png";
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
    let observedComposer: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | undefined;
    const syncGuardChrome = () => {
      adapter.positionGuardRoot(rootElement);

      const composer = adapter.findComposer();
      if (composer === observedComposer) return;

      resizeObserver?.disconnect();
      observedComposer = composer;

      if (composer && "ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(() => adapter.positionGuardRoot(rootElement));
        resizeObserver.observe(composer);
      }
    };
    const render = () => {
      syncGuardChrome();
      root.render(
        <AccordIndicator
          markUrl={accordMarkUrl}
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
    window.addEventListener("resize", syncGuardChrome);
    window.addEventListener("scroll", syncGuardChrome, true);

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
      const sequence = ++scanSeq.current;
      window.clearTimeout(liveScanTimer);
      syncGuardChrome();

      if (!text.trim()) {
        state.set({ phase: "idle", scan: undefined, message: undefined, draftText: "" });
        adapter.setComposerDecoratedState("clear");
        adapter.clearEntityDecorations();
        return;
      }

      state.set({ phase: "scanning", message: undefined, draftText: text });
      adapter.setComposerDecoratedState("scanning");
      adapter.clearEntityDecorations();

      liveScanTimer = window.setTimeout(() => {
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
            applyScanState(response.result, text);
          })
          .catch(() => {
            state.set({ phase: "failed", message: "Accord scan unavailable." });
            adapter.setComposerDecoratedState("failed");
          });
      }, 300);
    };

    const applyScanState = (scan: SafeScanResult, draftText: string) => {
      if (scan.action === "block") {
        state.set({ phase: "blocked", scan, message: scan.explanation, draftText });
        adapter.setComposerDecoratedState("blocked");
        adapter.setEntityDecorations(scan.decorations, "blocked", draftText);
      } else if (scan.action === "redact") {
        state.set({ phase: "redact", scan, message: scan.explanation, draftText });
        adapter.setComposerDecoratedState("redact");
        adapter.setEntityDecorations(scan.decorations, "redact", draftText);
      } else {
        state.set({ phase: "clear", scan, message: undefined, draftText });
        adapter.setComposerDecoratedState("clear");
        adapter.clearEntityDecorations();
      }
    };

    const unsubscribeDraft = adapter.subscribeToDraft(runLiveScan);
    const unsubscribeSubmit = adapter.subscribeToSubmit((submission) => {
      if (trustedGate.consumeIfAuthorized()) {
        return;
      }

      submission.prevent();
      state.set({ phase: "scanning", message: "Running final Accord scan...", draftText: adapter.getDraftText() });
      adapter.setComposerDecoratedState("scanning");
      adapter.clearEntityDecorations();

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
              const draftText = adapter.getDraftText();
              state.set({ ...nextState, draftText });
              if (nextState.phase) {
                adapter.setComposerDecoratedState(nextState.phase);
              }
              if (nextState.phase === "blocked" && nextState.scan) {
                adapter.setEntityDecorations(nextState.scan.decorations, "blocked", draftText);
              } else {
                adapter.clearEntityDecorations();
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
      syncGuardChrome();
    });

    const attachmentTimer = window.setInterval(() => {
      const attachmentNotice = adapter.hasAttachments();
      if (state.getSnapshot().attachmentNotice !== attachmentNotice) {
        state.set({ attachmentNotice });
      }
      syncGuardChrome();
    }, 1500);

    ctx.addEventListener(window, "beforeunload", () => {
      window.clearTimeout(liveScanTimer);
      window.clearInterval(attachmentTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncGuardChrome);
      window.removeEventListener("scroll", syncGuardChrome, true);
      adapter.clearEntityDecorations();
      unsubscribeDraft();
      unsubscribeSubmit();
      unsubscribeResponses();
      unsubscribeRoute();
      root.unmount();
      rootElement.remove();
    });
  }
});
