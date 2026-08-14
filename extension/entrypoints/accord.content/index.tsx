import React from "react";
import { createRoot } from "react-dom/client";
import { defineContentScript } from "wxt/utils/define-content-script";
import "./style.css";
import accordMarkUrl from "../../src/assets/accord-mark.png";
import { ChatGPTAdapter } from "../../src/adapters/chatgpt";
import type { SurfaceAssistantResponse } from "../../src/adapters/types";
import { extractGovernableAttachmentText } from "../../src/attachments/extract-text";
import { isExtractableDocumentAttachment, isSupportedTextAttachment, MAX_GUARDED_TEXT_ATTACHMENT_BYTES, mimeCategory, safeMimeType } from "../../src/attachments/policy";
import { renderResolvedAssistantResponse } from "../../src/governance/response-rehydration";
import type { EntityCountSummary } from "@accord/governance-core";
import type { GovernAttachmentsResult, GuardAttachmentInput, GuardTelemetryPayload, SafeScanResult } from "../../src/messaging/types";
import { sendGuardMessage } from "../../src/messaging/client";
import { attachmentSendBlockReason, type AttachmentGateStatus } from "../../src/state/attachment-send-gate";
import { runGovernedAttachmentHandoff } from "../../src/state/attachment-handoff";
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
      window.requestAnimationFrame(syncGuardChrome);
    };

    render();
    state.subscribe(render);

    const trustedGate = new TrustedSubmissionGate();
    const scanSeq = { current: 0 };
    let liveScanTimer: number | undefined;
    let conversationKey = adapter.getConversationKey();
    let attachmentGateStatus: AttachmentGateStatus = "none";
    const recordTelemetry = (payload: Omit<GuardTelemetryPayload, "surface" | "conversationKey">) => {
      void sendGuardMessage({
        type: "accord.recordTelemetry",
        payload: {
          surface: "chatgpt",
          conversationKey,
          ...payload
        }
      });
    };
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
        state.set({
          phase: "idle",
          scan: undefined,
          message: undefined,
          draftText: "",
          attachmentEntityCounts: undefined,
          attachmentRedactionCount: undefined
        });
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
      const submittedDraftText = adapter.getDraftText();

      if (trustedGate.consumeIfAuthorized()) {
        return;
      }

      submission.prevent();
      const attachmentBlockReason = attachmentSendBlockReason({
        gateStatus: attachmentGateStatus,
        hasHostAttachments: adapter.hasAttachments(),
        attachmentNotice: state.getSnapshot().attachmentNotice,
        phase: state.getSnapshot().phase,
        message: state.getSnapshot().message
      });

      if (attachmentBlockReason) {
        state.set({
          phase: "blocked",
          message: attachmentBlockReason,
          attachmentNotice: true,
          draftText: submittedDraftText
        });
        adapter.setComposerDecoratedState("blocked");
        adapter.clearEntityDecorations();
        recordTelemetry({
          eventType: "message_blocked",
          action: "block",
          riskScore: 70,
          riskLevel: "high",
          flags: ["Attachment gate blocked send"],
          messageLengthBucket: messageLengthBucket(submittedDraftText.length),
          metadata: {
            reasonCategory: "attachment_gate",
            reason: attachmentBlockReason
          }
        });
        return;
      }

      state.set({ phase: "scanning", message: "Running final Accord scan...", draftText: submittedDraftText });
      adapter.setComposerDecoratedState("scanning");
      adapter.clearEntityDecorations();

      void syncConversationKey()
        .then(() => {
          let finalScan: SafeScanResult | undefined;

          return runFinalSubmissionDecision({
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
              if (nextState.scan) {
                finalScan = nextState.scan;
              }
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
          }).then((outcome) => {
            const eventType = outcome === "submitted" ? "message_sent_to_ai" : outcome === "blocked" ? "message_blocked" : "extension_error";
            const scan = finalScan;

            recordTelemetry({
              eventType,
              action: scan?.action || (outcome === "blocked" ? "block" : outcome === "failed" ? "failed" : "allow"),
              riskScore: scan?.riskScore || 0,
              riskLevel: scan?.riskLevel || "low",
              flags: scan ? flagLabels(scan) : [],
              entityCounts: scan?.entityCounts || {},
              redactionCount: scan?.detectedEntityCount || 0,
              messageLengthBucket: messageLengthBucket(submittedDraftText.length),
              ...policyTelemetryFields(scan, "prompt"),
              metadata: {
                outcome,
                scanId: scan?.scanId || null,
                redacted: scan?.action === "redact",
                enforcementSource: scan?.enforcementSource || "accord_core",
                findingSources: scan?.flags.length ? "accord_core" : "none"
              }
            });

            return outcome;
          });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Accord could not complete the final scan.";
          state.set({ phase: "failed", message });
          adapter.setComposerDecoratedState("failed");
          recordTelemetry({
            eventType: "extension_error",
            action: "failed",
            riskScore: 0,
            riskLevel: "low",
            messageLengthBucket: messageLengthBucket(submittedDraftText.length),
            metadata: {
              reasonCategory: "final_scan_error",
              reason: message
            }
          });
        });
    });

    const unsubscribeAttachments = adapter.subscribeToAttachmentSelection((selection) => {
      attachmentGateStatus = "pending";
      state.set({ phase: "scanning", message: "Scanning file...", draftText: adapter.getDraftText(), attachmentNotice: true });

      void syncConversationKey()
        .then(() => buildAttachmentPayload(selection.files))
        .then((attachments) =>
          sendGuardMessage({
            type: "accord.governAttachments",
            payload: {
              surface: "chatgpt",
              conversationKey,
              sensitivity: "Internal",
              attachments
            }
          })
        )
        .then(async (message) => {
          if (!message.ok || !message.result || !("batchAction" in message.result)) {
            throw new Error(message.ok ? "Accord attachment governance failed." : message.error);
          }

          const result = message.result as GovernAttachmentsResult;

          if (result.batchAction !== "allow") {
            recordTelemetry(attachmentTelemetryPayload(result, "attachment_blocked"));
            attachmentGateStatus = "blocked";
            adapter.clearFileInput(selection.input);
            state.set({
              phase: "blocked",
              message: result.summary,
              attachmentNotice: true,
              attachmentEntityCounts: mergeEntityCounts(result),
              attachmentRedactionCount: result.results.reduce((sum, fileResult) => sum + fileResult.redactionCount, 0),
              draftText: adapter.getDraftText()
            });
            return;
          }

          const governedFiles = result.results.map((fileResult) => {
            if (typeof fileResult.sanitizedText !== "string") {
              throw new Error("Accord did not return a governed file copy.");
            }

            return new File([fileResult.sanitizedText], fileResult.sanitizedName, {
              type: hostAttachmentMimeType(fileResult.mimeType, fileResult.sanitizedName),
              lastModified: fileResult.lastModified
            });
          });

          const verified = await runGovernedAttachmentHandoff({
            files: governedFiles,
            setGovernedFiles: (files) => adapter.setGovernedFiles(selection.input, files),
            verifyGovernedFiles: (files) => adapter.verifyGovernedFiles(selection.input, files),
            verifyHostAccepted: (files) => adapter.verifyHostAttachmentAccepted(files),
            dispatchTrustedSelection: () => adapter.dispatchGovernedFileSelection(selection.input),
            clearFileInput: () => adapter.clearFileInput(selection.input),
            onState: (nextState) => {
              attachmentGateStatus = "blocked";
              state.set({ ...nextState, attachmentNotice: true, draftText: adapter.getDraftText() });
            }
          });

          if (!verified) return;
          attachmentGateStatus = "governed";
          recordTelemetry(attachmentTelemetryPayload(result, "attachment_governed"));

          const hasRedactions = result.results.some((fileResult) => fileResult.redactionCount > 0);
          state.set({
            phase: hasRedactions ? "redact" : "clear",
            message: result.summary,
            attachmentNotice: true,
            attachmentEntityCounts: mergeEntityCounts(result),
            attachmentRedactionCount: result.results.reduce((sum, fileResult) => sum + fileResult.redactionCount, 0),
            draftText: adapter.getDraftText()
          });
        })
        .catch((error: unknown) => {
          attachmentGateStatus = "blocked";
          adapter.clearFileInput(selection.input);
          const message = error instanceof Error ? error.message : "Accord could not govern this attachment.";
          state.set({ phase: "failed", message, attachmentNotice: true });
          recordTelemetry({
            eventType: "attachment_blocked",
            action: "failed",
            riskScore: 0,
            riskLevel: "low",
            attachmentCount: selection.files.length,
            metadata: {
              reasonCategory: "attachment_governance_error",
              reason: message
            }
          });
        });
    });

    const unsubscribeResponses = adapter.subscribeToAssistantResponses((response) => {
      void syncConversationKey().then(() => rehydrateResponse(response));
    });

    const rehydrateResponse = (response: SurfaceAssistantResponse) => {
      void renderResolvedAssistantResponse(
        response.element,
        response.id,
        (text) =>
          sendGuardMessage({
            type: "accord.rehydrateResponse",
            payload: {
              surface: "chatgpt",
              conversationKey,
              text
            }
          }).then((message) => {
            if (!message.ok || !message.result || !("resolvedText" in message.result)) {
              return {
                resolvedText: text,
                replacements: [],
                resolvedCount: 0,
                unresolvedPlaceholders: [],
                text,
                replacedCount: 0,
                unresolvedPlaceholderCount: 0
              };
            }

            if (message.result.resolvedCount > 0) {
              recordTelemetry({
                eventType: "assistant_response_rehydrated",
                action: "allow",
                riskScore: 0,
                riskLevel: "low",
                redactionCount: message.result.resolvedCount,
                metadata: {
                  responseId: response.id,
                  unresolvedPlaceholderCount: message.result.unresolvedPlaceholderCount
                }
              });
            }

            return message.result;
          }),
        { markUrl: accordMarkUrl }
      );
    };

    const unsubscribeRoute = adapter.subscribeToRouteChanges(() => {
      void syncConversationKey();
      syncGuardChrome();
    });

    const attachmentTimer = window.setInterval(() => {
      const attachmentNotice = adapter.hasAttachments();
      if (!attachmentNotice && attachmentGateStatus === "governed") {
        attachmentGateStatus = "none";
      }
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
      unsubscribeAttachments();
      unsubscribeResponses();
      unsubscribeRoute();
      root.unmount();
      rootElement.remove();
    });
  }
});

async function buildAttachmentPayload(files: File[]): Promise<GuardAttachmentInput[]> {
  return Promise.all(
    files.map(async (file) => {
      const input: GuardAttachmentInput = {
        id: crypto.randomUUID(),
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
        lastModified: file.lastModified
      };

      if (file.size <= MAX_GUARDED_TEXT_ATTACHMENT_BYTES && isSupportedTextAttachment(file.name, file.type)) {
        console.info("[Accord Guard] attachment candidate", {
          extension: file.name.split(".").pop()?.toLocaleLowerCase() || "",
          mimeCategory: mimeCategory(file.type),
          size: file.size,
          supportDecision: "read_locally"
        });
        input.text = await file.text();
        input.extractionKind = "native_text";
        input.extractedCharacterCount = input.text.length;
      } else if (isExtractableDocumentAttachment(file.name, file.type)) {
        console.info("[Accord Guard] attachment candidate", {
          extension: file.name.split(".").pop()?.toLocaleLowerCase() || "",
          mimeCategory: mimeCategory(file.type),
          size: file.size,
          supportDecision: "extract_text_copy"
        });
        const extraction = await extractGovernableAttachmentText(file);
        input.extractionKind = extraction.kind;
        input.extractionWarnings = extraction.warnings;

        if (extraction.status === "extracted") {
          input.text = extraction.text;
          input.extractedCharacterCount = extraction.text.length;
        } else {
          input.extractionReason = extraction.reason;
        }
      }

      return input;
    })
  );
}

function mergeEntityCounts(result: GovernAttachmentsResult): EntityCountSummary {
  return result.results.reduce<EntityCountSummary>((counts, fileResult) => {
    for (const [type, count] of Object.entries(fileResult.entityCounts)) {
      counts[type as keyof EntityCountSummary] = (counts[type as keyof EntityCountSummary] || 0) + count;
    }
    return counts;
  }, {});
}

function hostAttachmentMimeType(mimeType: string, name: string) {
  const safeType = safeMimeType(mimeType, name);
  return safeType.startsWith("text/") ? safeType : "text/plain";
}

function flagLabels(scan: SafeScanResult) {
  return scan.flags.map((flag) => flag.label || flag.type);
}

function messageLengthBucket(length: number) {
  if (length <= 0) return "empty";
  if (length <= 250) return "0-250";
  if (length <= 1000) return "251-1000";
  if (length <= 4000) return "1001-4000";
  return "4000+";
}

function attachmentTelemetryPayload(
  result: GovernAttachmentsResult,
  eventType: Extract<GuardTelemetryPayload["eventType"], "attachment_governed" | "attachment_blocked">
): Omit<GuardTelemetryPayload, "surface" | "conversationKey"> {
  const redactionCount = result.results.reduce((sum, fileResult) => sum + fileResult.redactionCount, 0);
  const riskScore = result.results.reduce((score, fileResult) => Math.max(score, fileResult.riskScore), 0);
  const entityCounts = mergeEntityCounts(result);
  const actions = Array.from(new Set(result.results.map((fileResult) => fileResult.action)));
  const blockedReasons = Array.from(
    new Set(
      result.results
        .map((fileResult) => fileResult.telemetry.blockedReasonCategory)
        .filter((item): item is string => typeof item === "string" && item.length > 0)
    )
  );
  const hasRedactions = redactionCount > 0;
  const action =
    eventType === "attachment_blocked"
      ? "blocked"
      : hasRedactions
        ? "redacted"
        : "clean";

  return {
    eventType,
    action,
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    flags: blockedReasons.length ? blockedReasons : hasRedactions ? ["Attachment redacted"] : ["Attachment governed"],
    entityCounts,
    redactionCount,
    attachmentCount: result.results.length,
    ...policyTelemetryFields(result.results.find((fileResult) => fileResult.policy?.triggered), "attachment"),
    metadata: {
      batchAction: result.batchAction,
      actionList: actions.join(","),
      blockedReasonCategories: blockedReasons.join(",") || null,
      summary: result.summary,
      enforcementSource: result.results.some((fileResult) => fileResult.policy?.triggered && fileResult.policy.executionAction === "block")
        ? "organization_policy"
        : "accord_core",
      findingSources: redactionCount > 0 || blockedReasons.length ? "accord_core" : "none"
    }
  };
}

function policyTelemetryFields(source: SafeScanResult | GovernAttachmentsResult["results"][number] | undefined, contentType: "prompt" | "attachment") {
  const policy = source?.policy;
  if (!policy?.triggered || !policy.rule) return {};

  return {
    organizationId: "test-company",
    employeeUserId: "browser-extension-user",
    ruleId: policy.rule.id,
    ruleKey: policy.rule.ruleKey,
    ruleVersion: policy.rule.version,
    policyBundleVersion: policy.bundleVersion,
    policyAction: policy.policyAction,
    policySeverity: policy.rule.severity,
    aiProvider: "chatgpt",
    destinationType: policy.rule.destinationType,
    contentType,
    detectedCategories: policy.detectedCategories
  };
}

function riskLevelFromScore(score: number): GuardTelemetryPayload["riskLevel"] {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}
