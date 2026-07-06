import "server-only";

import { redactSensitiveText } from "./scanner";
import type {
  ChatAttachmentMetadata,
  ChatContentPart,
  ChatGatewayRequest,
  ChatHistoryMessage,
  ChatPolicyDecision,
  ChatProviderMessage,
  ChatRiskFlag,
  ChatScanResult,
  GovernanceContext
} from "./types";

const ACCORD_SYSTEM_PROMPT = `You are Accord, an enterprise AI assistant operating inside a privacy-first AI governance gateway.

You help employees complete work tasks while respecting policy controls.

Important:
- The prompt you receive may be redacted.
- Numbered placeholders like [PERSON_1], [EMAIL_1], [PHONE_1], [ADDRESS_1], or [ACCOUNT_1] intentionally replace private details.
- Preserve placeholder identity exactly. Do not rename, merge, remove, or invent placeholder IDs.
- If referring to a redacted entity in generated output, reuse the existing placeholder token exactly.
- Do not ask the user to re-provide redacted identifiers unless the task truly cannot proceed without them.
- Preserve the user's intent from the sanitized prompt.
- If the user asks for a customer-facing, HR, legal, medical, financial, or regulated communication, provide safe neutral wording.
- Do not make final eligibility, legal, medical, hiring, lending, insurance, or financial decisions.
- Do not invent facts.
- Use the existing numbered placeholders in the output where identifiers were redacted.
- If a policy warning exists, help the user complete the task in a safer way.
- Keep the response useful, direct, and policy-aware.
- Accord's privacy mode stores metadata and redacted previews by default. Raw content should not be exposed in audit or governance contexts.`;

type BuildProviderContextInput = {
  request: Required<ChatGatewayRequest>;
  preflight: ChatScanResult;
  policyDecision: ChatPolicyDecision;
};

export type ProviderContext = {
  governanceContext: GovernanceContext;
  messages: ChatProviderMessage[];
  sanitizedHistory: ChatHistoryMessage[];
};

export function buildProviderContext({ request, preflight, policyDecision }: BuildProviderContextInput): ProviderContext {
  const sanitizedHistory = sanitizeHistory(request.messages);
  const governanceContext = buildGovernanceContext(request, preflight, policyDecision);
  const userContentParts: ChatContentPart[] = [
    { type: "text", text: preflight.redactedText },
    ...buildAttachmentContentParts(request.attachments)
  ];
  const messages: ChatProviderMessage[] = [
    {
      role: "system",
      content: [{ type: "text", text: ACCORD_SYSTEM_PROMPT }]
    },
    {
      role: "system",
      content: [{ type: "text", text: formatGovernanceContext(governanceContext, request.tools, request.attachments) }]
    },
    ...sanitizedHistory.map((message): ChatProviderMessage => ({
      role: message.role,
      content: [{ type: "text", text: message.content }]
    })),
    {
      role: "user",
      content: userContentParts
    }
  ];

  return {
    governanceContext,
    messages,
    sanitizedHistory
  };
}

function buildGovernanceContext(
  request: Required<ChatGatewayRequest>,
  preflight: ChatScanResult,
  policyDecision: ChatPolicyDecision
): GovernanceContext {
  return {
    useCase: request.useCase,
    sensitivity: request.sensitivity,
    thinkingMode: request.thinkingMode,
    policyAction: policyDecision.action,
    riskScore: preflight.riskScore,
    riskLevel: getRiskLevel(preflight.riskScore),
    flags: preflight.flags.map((flag) => flag.type),
    redactedPromptPreview: preflight.redactedText,
    redactions: preflight.redactions,
    redactionCount: preflight.redactions.length,
    redactionEntityCounts: preflight.entityCounts,
    loggingBehavior: {
      rawContentStored: false,
      redactedPreviewStored: true,
      metadataStored: true
    },
    instruction: buildTaskInstruction(request, preflight.flags, policyDecision)
  };
}

function sanitizeHistory(messages: ChatHistoryMessage[] = []) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: redactSensitiveText(message.content)
    }))
    .filter((message) => message.content.trim().length > 0);
}

function formatGovernanceContext(
  context: GovernanceContext,
  tools: string[],
  attachments: ChatAttachmentMetadata[]
) {
  const attachmentSummary = attachments.length
    ? attachments.map((attachment) => `${attachment.name} (${attachment.type})`).join(", ")
    : "No file content attached.";
  const attachmentPolicySummary = attachments.length
    ? attachments
        .map((attachment) => {
          const status = attachment.extractionStatus || "metadata";
          const flags = attachment.flags?.length ? attachment.flags.map((flag) => flag.type).join(", ") : "none";
          const visualScan = attachment.visualScanLimited ? ", visual_scan_limited=true" : "";
          return `${attachment.name}: status=${status}, flags=${flags}${visualScan}`;
        })
        .join("; ")
    : "none";
  const redactionSummary = context.redactionCount
    ? formatEntityCounts(context.redactionEntityCounts)
    : "None";
  const placeholderSummary = context.redactions.length
    ? context.redactions.map((redaction) => redaction.placeholder).join(", ")
    : "none";

  return `Governance context:
Use case: ${context.useCase}
Sensitivity: ${context.sensitivity}
Thinking mode: ${context.thinkingMode ? "enabled" : "disabled"}
Policy decision: ${context.policyAction}
Risk score: ${context.riskScore}
Risk level: ${context.riskLevel}
Detected flags: ${context.flags.length ? context.flags.join(", ") : "none"}
Redacted entities: ${redactionSummary}
Placeholder IDs: ${placeholderSummary}
Placeholder rule: Private entities are represented by stable numbered placeholders. Preserve existing placeholders exactly; do not rename, merge, or invent them.
Selected tools: ${tools.length ? tools.join(", ") : "none"}
Attachments metadata: ${attachmentSummary}
Attachment scan results: ${attachmentPolicySummary}
Redacted prompt preview: ${context.redactedPromptPreview}
Logging behavior: rawContentStored=false, redactedPreviewStored=true, metadataStored=true
Instruction: ${context.instruction}`;
}

function buildAttachmentContentParts(attachments: ChatAttachmentMetadata[]): ChatContentPart[] {
  return attachments.flatMap((attachment): ChatContentPart[] => {
    const mimeType = attachment.mimeType || "application/octet-stream";
    const size = typeof attachment.size === "number" ? attachment.size : 0;
    const metadataPart: ChatContentPart = {
      type: "file_metadata",
      name: attachment.name,
      mimeType,
      size,
      kind: attachment.kind || "metadata",
      riskScore: attachment.riskScore,
      flags: attachment.flags?.map((flag) => flag.type),
      visualScanLimited: attachment.visualScanLimited,
      extractionStatus: attachment.extractionStatus
    };

    if (attachment.kind === "image" && attachment.data) {
      return [
        metadataPart,
        {
          type: "image",
          mimeType,
          data: attachment.data,
          name: attachment.name
        }
      ];
    }

    if ((attachment.kind === "text" || attachment.kind === "document") && attachment.redactedText?.trim()) {
      return [
        metadataPart,
        {
          type: "document_text",
          text: attachment.redactedText,
          name: attachment.name,
          mimeType
        }
      ];
    }

    return [metadataPart];
  });
}

function buildTaskInstruction(
  request: Required<ChatGatewayRequest>,
  flags: ChatRiskFlag[],
  policyDecision: ChatPolicyDecision
) {
  const prompt = request.prompt.toLowerCase();
  const asksForCommunication = /\b(?:email|message|letter|response|reply|draft|write)\b/.test(prompt);
  const regulated = flags.some((flag) => flag.type.startsWith("regulated_"));

  if (asksForCommunication && regulated) {
    return "The user is asking for help drafting a regulated communication. Respond with useful neutral wording, use placeholders for redacted identifiers, avoid making final decisions, and do not ask for the redacted identifiers again.";
  }

  if (asksForCommunication) {
    return "The user is asking for help drafting communication. Preserve the work intent, use existing numbered placeholders for redacted identifiers, and avoid asking for those identifiers again.";
  }

  if (policyDecision.action === "redact") {
    return "Personal data was redacted. Continue the task using existing numbered placeholders and do not request redacted identifiers unless the task cannot proceed without them.";
  }

  if (policyDecision.action === "warn") {
    return "A policy warning exists. Help the user complete the task in a safer, policy-aware way.";
  }

  return "Answer the user's sanitized request directly while respecting Accord governance and privacy defaults.";
}

function getRiskLevel(score: number) {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function formatEntityCounts(counts: GovernanceContext["redactionEntityCounts"]) {
  const entries = Object.entries(counts)
    .filter(([, count]) => Boolean(count))
    .map(([type, count]) => `${count} ${type}`);

  return entries.length ? entries.join(", ") : "None";
}
