import "server-only";

import { buildProviderContext } from "./context-builder";
import { getModelEntry, unsupportedInputTypes } from "./model-registry";
import { getChatProvider } from "./providers";
import { decidePolicy, rehydrateResponse, scanPolicyText, scanText } from "./scanner";
import type {
  ChatAttachmentMetadata,
  ChatAuditTrailEvent,
  ChatContentPartType,
  ChatGatewayRequest,
  ChatGatewayResponse,
  ChatLoggingBehavior,
  ChatPolicyDecision,
  ChatRedactionSummary,
  ChatRiskFlag,
  EntityCountSummary
} from "./types";

export class ChatGatewayInputError extends Error {}

export async function runChatGateway(input: unknown): Promise<ChatGatewayResponse> {
  const request = normalizeRequest(input);
  const auditTrailEvents: ChatAuditTrailEvent[] = [];
  const modelEntry = getModelEntry(request.model);
  const contentSupportWarnings = validateModelSupport(modelEntry.supportedInputTypes, request.attachments);

  addAuditEvent(auditTrailEvents, "request_received", "Chat request received by server gateway.", {
    promptLength: request.prompt.length,
    model: modelEntry.label,
    useCase: request.useCase,
    sensitivity: request.sensitivity,
    toolCount: request.tools.length,
    attachmentCount: request.attachments.length
  });

  const preflight = scanText(request.prompt, "preflight", request.sensitivity);
  const attachmentFlags = request.attachments.flatMap((attachment) => attachment.flags || []);
  const attachmentRiskScore = request.attachments.reduce((score, attachment) => Math.max(score, attachment.riskScore || 0), 0);
  const initialPolicyDecision = decidePolicy(preflight);
  const finalPolicyDecision = applyAttachmentPolicy(initialPolicyDecision, attachmentFlags);
  const loggingBehavior = buildLoggingBehavior();

  addAuditEvent(auditTrailEvents, "preflight_scan", "Pre-flight scanner completed.", {
    riskScore: preflight.riskScore,
    flagCount: preflight.flags.length,
    policyAction: finalPolicyDecision.action
  });
  if (request.attachments.length) {
    addAuditEvent(auditTrailEvents, "attachment_scan", "Attachment metadata and extracted text scan results attached to request.", {
      attachmentCount: request.attachments.length,
      attachmentFlagCount: attachmentFlags.length,
      maxAttachmentRiskScore: attachmentRiskScore
    });
  }
  addAuditEvent(auditTrailEvents, "logging_policy", "Raw prompt and response storage disabled.", {
    rawPromptStored: false,
    rawResponseStored: false
  });
  if (preflight.redactions.length) {
    addAuditEvent(auditTrailEvents, "redaction_applied", "Sensitive identifiers were replaced with stable placeholders before provider routing.", {
      redactionCount: preflight.redactions.length,
      entityTypes: formatEntityCounts(preflight.entityCounts),
      placeholders: preflight.redactions.map((redaction) => redaction.placeholder).join(", ")
    });
  }
  if (request.attachments.some((attachment) => attachment.redactions?.length)) {
    addAuditEvent(auditTrailEvents, "attachment_redaction_applied", "Attachment text was redacted before provider routing.", {
      redactionCount: request.attachments.reduce((count, attachment) => count + (attachment.redactions?.length || 0), 0)
    });
  }

  if (contentSupportWarnings.length) {
    throw new ChatGatewayInputError(contentSupportWarnings[0]);
  }

  const provider = getChatProvider(modelEntry);
  const providerContext = buildProviderContext({
    request,
    preflight,
    policyDecision: finalPolicyDecision
  });

  addAuditEvent(auditTrailEvents, "context_built", "Provider context built from redacted prompt, policy metadata, and sanitized history.", {
    providerMessageCount: providerContext.messages.length,
    sanitizedHistoryCount: providerContext.sanitizedHistory.length,
    redactionCount: providerContext.governanceContext.redactions.length
  });

  let assistantResponse =
    "Accord blocked this request before provider routing. Remove secrets or instruction-bypass language, then try again.";
  let providerModel = "not-called";
  let providerCalled = false;

  if (finalPolicyDecision.action !== "block") {
    providerCalled = true;
    addAuditEvent(auditTrailEvents, "provider_selected", "Provider selected after pre-flight scan.", {
      provider: provider.id,
      providerMode: provider.mode,
      selectedModel: modelEntry.label,
      promptSentAs: finalPolicyDecision.redacted ? "redacted_context" : "policy_screened_context"
    });

    const providerResult = await provider.complete({
      messages: providerContext.messages,
      modelEntry,
      governanceContext: providerContext.governanceContext,
      redactedPromptPreview: preflight.redactedText,
      sanitizedHistory: providerContext.sanitizedHistory,
      attachments: request.attachments,
      model: request.model,
      useCase: request.useCase,
      sensitivity: request.sensitivity,
      thinkingMode: request.thinkingMode,
      tools: request.tools,
      policyDecision: {
        ...finalPolicyDecision,
        providerCalled: true
      }
    });

    assistantResponse = providerResult.text;
    providerModel = providerResult.model;
  }

  // Post-response governance scans are policy-only. They must not create new entity placeholders or mutate provider prose.
  // Only after this scan do we rehydrate exact trusted placeholders from the current request map for the employee.
  const postResponse = scanPolicyText(assistantResponse, "post_response", request.sensitivity);
  const rehydratedResponse = rehydrateResponse(postResponse.redactedText, preflight.redactionMap);
  const safeAssistantResponse = rehydratedResponse.text;

  addAuditEvent(auditTrailEvents, "post_response_scan", "Post-response scanner completed.", {
    riskScore: postResponse.riskScore,
    flagCount: postResponse.flags.length
  });
  addAuditEvent(auditTrailEvents, "response_rehydrated_locally", "Known placeholders were rehydrated server-side after post-response scanning.", {
    rehydratedPlaceholderCount: rehydratedResponse.replacedCount,
    unresolvedPlaceholderCount: rehydratedResponse.unresolvedPlaceholderCount,
    rehydrationSuccess: rehydratedResponse.unresolvedPlaceholderCount === 0
  });

  const allFlags = [...preflight.flags, ...attachmentFlags, ...postResponse.flags];
  const finalRiskScore = Math.max(preflight.riskScore, attachmentRiskScore, postResponse.riskScore);
  const redactionSummary = buildRedactionSummary(preflight.redactions, preflight.entityCounts, rehydratedResponse);

  return {
    assistantResponse: safeAssistantResponse,
    riskScore: finalRiskScore,
    flags: allFlags,
    policyDecision: {
      ...finalPolicyDecision,
      providerCalled,
      redacted: finalPolicyDecision.redacted
    },
    redactedPromptPreview: preflight.redactedText,
    loggingBehavior,
    auditTrailEvents,
    provider: {
      id: providerCalled ? provider.id : "none",
      label: providerCalled ? provider.label : "Not called",
      mode: providerCalled ? provider.mode : "none",
      model: providerModel,
      selectedModel: modelEntry.label
    },
    modelCapabilities: modelEntry.capabilities,
    attachmentResults: request.attachments,
    contentSupport: {
      supported: true,
      warnings: []
    },
    governanceContext: providerContext.governanceContext,
    redactionSummary,
    postResponse: {
      riskScore: postResponse.riskScore,
      flags: postResponse.flags,
      redactedResponsePreview: postResponse.redactedText
    }
  };
}

function normalizeRequest(input: unknown): Required<ChatGatewayRequest> {
  if (!input || typeof input !== "object") {
    throw new ChatGatewayInputError("Request body must be an object.");
  }

  const body = input as Partial<ChatGatewayRequest>;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    throw new ChatGatewayInputError("Prompt is required.");
  }

  return {
    prompt,
    model: typeof body.model === "string" && body.model.trim() ? body.model : "GPT-4.1",
    useCase: typeof body.useCase === "string" && body.useCase.trim() ? body.useCase : "General",
    sensitivity: typeof body.sensitivity === "string" && body.sensitivity.trim() ? body.sensitivity : "Internal",
    thinkingMode: Boolean(body.thinkingMode),
    tools: Array.isArray(body.tools) ? body.tools.filter((tool): tool is string => typeof tool === "string") : [],
    conversationId:
      typeof body.conversationId === "string" && body.conversationId.trim() ? body.conversationId : "ephemeral",
    messages: Array.isArray(body.messages)
      ? body.messages
          .filter(
            (message): message is { role: "user" | "assistant"; content: string } =>
              Boolean(message) &&
              typeof message === "object" &&
              (message.role === "user" || message.role === "assistant") &&
              typeof message.content === "string"
          )
          .map((message) => ({
            role: message.role,
            content: message.content
          }))
      : [],
    attachments: normalizeAttachments(body.attachments)
  };
}

function normalizeAttachments(value: unknown): ChatAttachmentMetadata[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (attachment): attachment is ChatAttachmentMetadata =>
        Boolean(attachment) &&
        typeof attachment === "object" &&
        typeof (attachment as ChatAttachmentMetadata).name === "string" &&
        typeof (attachment as ChatAttachmentMetadata).type === "string"
    )
    .map((attachment) => {
      const redactedText = typeof attachment.redactedText === "string" ? attachment.redactedText.slice(0, 80_000) : undefined;
      const inlineTextScan = redactedText ? scanText(redactedText, "attachment", "Internal") : null;
      const mergedFlags = [...(attachment.flags || []), ...(inlineTextScan?.flags || [])];

      return {
        id: attachment.id,
        name: attachment.name.slice(0, 180),
        type: attachment.type.slice(0, 40),
        kind: normalizeAttachmentKind(attachment.kind),
        mimeType: typeof attachment.mimeType === "string" ? attachment.mimeType.slice(0, 120) : undefined,
        size: typeof attachment.size === "number" ? attachment.size : undefined,
        redactedText: inlineTextScan?.redactedText || redactedText,
        data: typeof attachment.data === "string" && attachment.kind === "image" ? attachment.data : undefined,
        riskScore: Math.max(attachment.riskScore || 0, inlineTextScan?.riskScore || 0),
        flags: dedupeFlags(mergedFlags),
        redactions: inlineTextScan?.redactions.length ? inlineTextScan.redactions : attachment.redactions,
        visualScanLimited: Boolean(attachment.visualScanLimited),
        extractionStatus: attachment.extractionStatus,
        policyDecision: attachment.policyDecision
      };
    });
}

function normalizeAttachmentKind(kind: ChatAttachmentMetadata["kind"]): ChatAttachmentMetadata["kind"] {
  if (kind === "text" || kind === "image" || kind === "document" || kind === "metadata") return kind;
  return "metadata";
}

function validateModelSupport(supportedTypes: ChatContentPartType[], attachments: ChatAttachmentMetadata[]) {
  const inputTypes = new Set<ChatContentPartType>(["text"]);

  for (const attachment of attachments) {
    inputTypes.add("file_metadata");
    if (attachment.kind === "image") inputTypes.add("image");
    if ((attachment.kind === "text" || attachment.kind === "document") && attachment.redactedText?.trim()) {
      inputTypes.add("document_text");
    }
  }

  const unsupported = unsupportedInputTypes({ supportedInputTypes: supportedTypes }, Array.from(inputTypes));

  if (!unsupported.length) return [];

  if (unsupported.includes("image")) {
    return ["This model does not support image input. Choose a vision-capable model."];
  }

  if (unsupported.includes("document_text")) {
    return ["This model does not support document text input. Choose a model with document support."];
  }

  return [`This model does not support ${unsupported.join(", ")} input.`];
}

function applyAttachmentPolicy(policyDecision: ChatPolicyDecision, attachmentFlags: ChatRiskFlag[]): ChatPolicyDecision {
  const hasSecret = attachmentFlags.some((flag) => flag.type === "secret");
  const hasPromptInjection = attachmentFlags.some((flag) => flag.type === "prompt_injection");
  const hasPii = attachmentFlags.some(
    (flag) => flag.type === "email" || flag.type === "phone" || flag.type === "address" || flag.type === "account" || flag.type === "possible_name"
  );
  const hasRegulatedContext = attachmentFlags.some((flag) => flag.type.startsWith("regulated_"));

  if (hasSecret || hasPromptInjection) {
    return {
      action: "block",
      reason: hasSecret
        ? "Credential-like content in an attachment is not sent to providers."
        : "Instruction-bypass language in an attachment requires review before any provider call.",
      requiresReview: true,
      providerCalled: false,
      redacted: true
    };
  }

  if (policyDecision.action === "block") return policyDecision;

  if (hasPii) {
    return {
      action: "redact",
      reason: "Personal data was detected in text or attachments and redacted before provider routing.",
      requiresReview: policyDecision.requiresReview || hasRegulatedContext,
      providerCalled: false,
      redacted: true
    };
  }

  if (policyDecision.action === "allow" && hasRegulatedContext) {
    return {
      action: "warn",
      reason: "Regulated context was detected in an attachment; metadata and redacted previews remain the default evidence.",
      requiresReview: true,
      providerCalled: false,
      redacted: policyDecision.redacted
    };
  }

  return policyDecision;
}

function dedupeFlags(flags: ChatRiskFlag[]) {
  const seen = new Set<string>();

  return flags.filter((flag) => {
    const key = `${flag.stage}:${flag.type}:${flag.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildLoggingBehavior(): ChatLoggingBehavior {
  return {
    rawPromptStored: false,
    rawResponseStored: false,
    retained: ["metadata", "risk_flags", "policy_decision", "redacted_prompt_preview", "redacted_response_preview", "audit_events"],
    note: "Governance without surveillance: Accord keeps metadata and redacted previews by default."
  };
}

function buildRedactionSummary(
  redactions: Array<{ placeholder: string }>,
  byType: EntityCountSummary,
  rehydration: { replacedCount: number; unresolvedPlaceholderCount: number }
): ChatRedactionSummary {
  return {
    total: redactions.length,
    byType,
    placeholders: redactions.map((redaction) => redaction.placeholder),
    providerSawPlaceholderContent: redactions.length > 0,
    responseRehydrated: rehydration.replacedCount > 0,
    rehydratedPlaceholderCount: rehydration.replacedCount,
    unresolvedPlaceholderCount: rehydration.unresolvedPlaceholderCount
  };
}

function formatEntityCounts(counts: EntityCountSummary) {
  const entries = Object.entries(counts)
    .filter(([, count]) => Boolean(count))
    .map(([type, count]) => `${count} ${type}`);

  return entries.length ? entries.join(", ") : "none";
}

function addAuditEvent(
  events: ChatAuditTrailEvent[],
  type: string,
  message: string,
  metadata?: ChatAuditTrailEvent["metadata"]
) {
  events.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    message,
    metadata
  });
}
