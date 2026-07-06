"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Code2, FileSearch, Globe2, ListFilter, ScanSearch, ScrollText } from "lucide-react";
import { getModelEntry, providerLabel } from "@/lib/chat/model-registry";
import type { ChatAttachmentMetadata, ChatGatewayResponse, ChatPolicyAction } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { ChatComposer } from "./chat-composer";
import { ChatHistorySidebar } from "./chat-history-sidebar";
import { ChatThread } from "./chat-thread";
import { ChatTopBar } from "./chat-top-bar";
import { GovernancePanel } from "./governance-panel";
import { detectRisk } from "./risk";
import { VoiceModePanel } from "./voice-mode-panel";
import type { Attachment, ChatMessage, Conversation, RiskState, ToolOption, VoiceState } from "./types";

const samplePrompt = "Can you write an email to John Smith at john.smith@email.com about his denied loan application?";

const conversations: Conversation[] = [
  { id: "draft-customer-response", title: "Draft customer response", group: "Pinned", risk: "warn", pinned: true },
  { id: "review-support-tone", title: "Review support tone", group: "Today", risk: "clean" },
  { id: "summarize-policy-update", title: "Summarize policy update", group: "Today", risk: "clean" },
  { id: "analyze-vendor-contract", title: "Analyze vendor contract", group: "Previous 7 days", risk: "warn" },
  { id: "debug-api-error", title: "Debug API error", group: "Previous 7 days", risk: "high" },
  { id: "q2-compliance-report", title: "Q2 compliance report", group: "Older", risk: "clean" }
];

const toolOptions: ToolOption[] = [
  { id: "web", label: "Web research", description: "Gather current context before drafting.", icon: Globe2, enabled: true },
  { id: "docs", label: "Document analysis", description: "Extract issues from uploaded files.", icon: FileSearch, enabled: true },
  { id: "code", label: "Code review", description: "Check code for bugs and policy-sensitive data.", icon: Code2, enabled: true },
  { id: "policy", label: "Policy check", description: "Run governance rules before finalizing.", icon: ScanSearch, enabled: true },
  { id: "summary", label: "Summarization", description: "Condense long context with redaction.", icon: ScrollText, enabled: true },
  { id: "data", label: "Data extraction", description: "Pull structured fields from approved files.", icon: ListFilter, enabled: false }
];

const seededMessages: ChatMessage[] = [
  {
    id: 1,
    role: "system",
    content: "Pre-flight scan complete · Prompt redacted"
  },
  {
    id: 2,
    role: "user",
    content: samplePrompt,
    meta: "GPT-4.1 / Customer Support / Regulated"
  },
  {
    id: 3,
    role: "assistant",
    content:
      "I can help draft a policy-safe response, but the customer name and email should be removed before the model call is retained for review. Use the approved adverse-action language and keep the final decision tied to the formal notice.",
    meta: "Prompt redacted before review"
  }
];

function policyActionLabel(action: ChatPolicyAction): RiskState["decision"] {
  const labels: Record<ChatPolicyAction, RiskState["decision"]> = {
    allow: "Allow",
    warn: "Warn",
    redact: "Redact",
    block: "Block"
  };

  return labels[action];
}

function gatewayResponseToRisk(result: ChatGatewayResponse): RiskState {
  const categories = Array.from(new Set(result.flags.map((flag) => flag.label)));
  const decision = policyActionLabel(result.policyDecision.action);

  return {
    categories: categories.length ? categories : ["No elevated category"],
    decision,
    score: result.riskScore,
    tone: decision === "Block" ? "critical" : decision === "Allow" ? "clear" : "warning",
    detectedEntityCount: result.redactionSummary.total
  };
}

function getRedactionExplanation(risk: RiskState) {
  const categories = new Set(risk.categories);
  const hasPersonalEntity =
    categories.has("Personal data") ||
    categories.has("Email address") ||
    categories.has("Phone number") ||
    categories.has("Possible personal name") ||
    categories.has("Address") ||
    categories.has("Account identifier");

  if (categories.has("Secret or credential")) {
    return "Accord detected a possible secret or API key. This request was blocked before any provider call.";
  }

  if (categories.has("Prompt injection attempt")) {
    return "Accord detected instructions that may bypass policy controls. This request was blocked.";
  }

  if (hasPersonalEntity && categories.has("Regulated financial context")) {
    return "Accord detected personal data and regulated financial context. Identifiers were replaced with stable placeholders before model routing.";
  }

  if (hasPersonalEntity) {
    return "Accord detected personal data. Identifiers were replaced with stable placeholders before model routing.";
  }

  return "Accord detected policy-sensitive context. The request is routed through the governance gateway with metadata and redacted previews by default.";
}

async function sendChatRequest(payload: {
  prompt: string;
  model: string;
  useCase: string;
  sensitivity: string;
  thinkingMode: boolean;
  tools: string[];
  conversationId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  attachments: ChatAttachmentMetadata[];
}) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as ChatGatewayResponse | { error?: string };

  if (!response.ok) {
    throw new Error("error" in data && data.error ? data.error : "Chat gateway failed.");
  }

  return data as ChatGatewayResponse;
}

function toChatAttachmentPayload(attachment: Attachment): ChatAttachmentMetadata {
  return {
    id: attachment.id,
    name: attachment.name,
    type: attachment.type,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    size: attachment.size,
    redactedText: attachment.redactedText,
    data: attachment.kind === "image" ? attachment.data : undefined,
    riskScore: attachment.riskScore,
    flags: attachment.flags,
    redactions: attachment.redactions,
    visualScanLimited: attachment.visualScanLimited,
    extractionStatus: attachment.extractionStatus,
    policyDecision: attachment.policyDecision
  };
}

function buildTurnEventSummary(result: ChatGatewayResponse) {
  const events = ["Pre-flight scan complete"];

  if (result.policyDecision.action === "block") {
    events.push("Provider blocked");
  } else {
    if (result.policyDecision.redacted) events.push("Prompt redacted");
    events.push("Provider routed");
  }

  events.push(result.postResponse.flags.length ? "Post-scan flagged" : "Post-scan passed");
  if (result.redactionSummary.responseRehydrated) events.push("Response rehydrated locally");

  return events.join(" · ");
}

type GatewayStatus = {
  provider: {
    id: string;
    label: string;
    mode: string;
    openAIConfigured: boolean;
  };
  configuredProviders?: Record<string, boolean>;
  models?: Array<{ id: string; label: string; provider: string }>;
  loggingBehavior: {
    rawPromptStored: false;
    rawResponseStored: false;
    note: string;
  };
};

export function ChatWorkspace() {
  const [selectedConversationId, setSelectedConversationId] = useState("new-chat");
  const [title, setTitle] = useState("New governed chat");
  const [model, setModel] = useState("GPT-4.1");
  const [useCase, setUseCase] = useState("Customer Support");
  const [sensitivity, setSensitivity] = useState("Regulated");
  const [thinkingMode, setThinkingMode] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(["policy"]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [governanceCollapsed, setGovernanceCollapsed] = useState(true);
  const [gatewayResult, setGatewayResult] = useState<ChatGatewayResponse | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [showRedactionExplanation, setShowRedactionExplanation] = useState(false);

  const selectedModelEntry = useMemo(() => getModelEntry(model), [model]);
  const contentSupportWarning = useMemo(() => {
    if (attachments.some((attachment) => attachment.kind === "image") && !selectedModelEntry.capabilities.images) {
      return "This model does not support image input. Choose a vision-capable model.";
    }

    if (
      attachments.some((attachment) => (attachment.kind === "text" || attachment.kind === "document") && attachment.redactedText) &&
      !selectedModelEntry.capabilities.documents
    ) {
      return "This model does not support document text input. Choose a model with document support.";
    }

    return null;
  }, [attachments, selectedModelEntry]);
  const liveRisk = useMemo(() => detectRisk(input, sensitivity), [input, sensitivity]);
  const risk = input.trim() || !gatewayResult ? liveRisk : gatewayResponseToRisk(gatewayResult);
  const activeWarning =
    !warningDismissed &&
    input.trim().length > 0 &&
    (risk.decision === "Block" || risk.detectedEntityCount > 0);
  const sendDisabled = !input.trim() || isSending || Boolean(contentSupportWarning) || activeWarning;
  const governanceAttachments = gatewayResult?.attachmentResults.length ? gatewayResult.attachmentResults : attachments;
  const providerStatusLabel = gatewayStatus?.configuredProviders?.openai ? "OpenAI ready" : "Mock fallback";

  useEffect(() => {
    let active = true;

    fetch("/api/chat", { method: "GET", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((status: GatewayStatus | null) => {
        if (active) setGatewayStatus(status);
      })
      .catch(() => {
        if (active) setGatewayStatus(null);
      });

    return () => {
      active = false;
    };
  }, []);

  function handleSelectConversation(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;

    setSelectedConversationId(id);
    setTitle(conversation.title);
    setMessages(conversation.id === "draft-customer-response" ? seededMessages : []);
    setInput(conversation.id === "draft-customer-response" ? samplePrompt : "");
    setAttachments(
      conversation.id === "analyze-vendor-contract"
        ? [
            {
              id: "sample-vendor-msa",
              name: "vendor-msa.docx",
              type: "DOCX",
              kind: "metadata",
              mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              size: 42000,
              extractionStatus: "metadata_only_todo"
            }
          ]
        : []
    );
    setWarningDismissed(false);
    setShowRedactionExplanation(false);
    setGatewayResult(null);
    setError(null);
  }

  function handleNewChat() {
    setSelectedConversationId("new-chat");
    setTitle("New governed chat");
    setMessages([]);
    setInput("");
    setAttachments([]);
    setSelectedToolIds(["policy"]);
    setWarningDismissed(false);
    setShowRedactionExplanation(false);
    setGatewayResult(null);
    setError(null);
  }

  function handleToggleTool(id: string) {
    const tool = toolOptions.find((item) => item.id === id);
    if (!tool?.enabled) return;
    setSelectedToolIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function handleUploadAttachment(file: File) {
    setIsUploadingAttachment(true);
    setAttachmentError(null);
    setGatewayResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { attachment?: ChatAttachmentMetadata; error?: string };

      if (!response.ok || !data.attachment) {
        throw new Error(data.error || "Attachment upload failed.");
      }

      const uploaded = {
        ...data.attachment,
        id: data.attachment.id || crypto.randomUUID()
      } satisfies Attachment;

      setAttachments((current) => [...current, uploaded]);
    } catch (caughtError) {
      setAttachmentError(caughtError instanceof Error ? caughtError.message : "Attachment upload failed.");
    } finally {
      setIsUploadingAttachment(false);
    }
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    if (contentSupportWarning) {
      setError(contentSupportWarning);
      return;
    }

    const baseId = Date.now();
    setIsSending(true);
    setError(null);

    try {
      const result = await sendChatRequest({
        prompt: trimmed,
        model,
        useCase,
        sensitivity,
        thinkingMode,
        tools: selectedToolIds,
        conversationId: selectedConversationId,
        messages: messages
          .filter((message): message is ChatMessage & { role: "user" | "assistant" } => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            role: message.role,
            content: message.content
          })),
        attachments: attachments.map(toChatAttachmentPayload)
      });

      const policyLabel = policyActionLabel(result.policyDecision.action);
      const policyMeta = result.redactionSummary.responseRehydrated
        ? "REDACTED + REHYDRATED"
        : result.policyDecision.redacted
          ? "REDACTED"
          : policyLabel.toUpperCase();
      const meta = `${result.provider.label.toUpperCase()} / ${result.provider.model.toUpperCase()} / ${policyMeta} / RISK ${result.riskScore}`;

      setGatewayResult(result);
      setMessages((current) => [
        ...current,
        {
          id: baseId,
          role: "system",
          content: buildTurnEventSummary(result)
        },
        {
          id: baseId + 1,
          role: "user",
          content: trimmed,
          meta: `${model} / ${useCase} / ${sensitivity} / Provider saw redacted preview`
        },
        {
          id: baseId + 2,
          role: "assistant",
          content: result.assistantResponse,
          meta
        }
      ]);
      setInput("");
      setAttachments([]);
      setWarningDismissed(false);
      setShowRedactionExplanation(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Chat gateway failed.");
    } finally {
      setIsSending(false);
    }
  }

  function handleEditMessage() {
    setShowRedactionExplanation(false);
    document.getElementById("chat-input")?.focus();
  }

  function handleCancelWarning() {
    setInput("");
    setWarningDismissed(false);
    setShowRedactionExplanation(false);
  }

  function handleStarterSelect(prompt: string) {
    setInput(prompt);
    setGatewayResult(null);
    setError(null);
    setShowRedactionExplanation(false);
  }

  return (
    <div className="flex h-screen min-h-[640px] flex-col bg-[#f7f8fb] p-0 sm:p-2">
      <div className="flex min-h-0 flex-1 gap-2">
        <ChatHistorySidebar
          conversations={conversations}
          selectedId={selectedConversationId}
          open={historyOpen}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
          onClose={() => setHistoryOpen(false)}
        />

        <section className="flex min-w-0 flex-1 overflow-hidden rounded-none border border-accord-border bg-white shadow-sm sm:rounded-2xl">
          <div className="flex min-w-0 flex-1 flex-col">
            <ChatTopBar
              title={title}
              model={model}
              useCase={useCase}
              sensitivity={sensitivity}
              thinkingMode={thinkingMode}
              toolsOpen={toolsOpen}
              selectedToolIds={selectedToolIds}
              toolOptions={toolOptions}
              governanceCollapsed={governanceCollapsed}
              providerStatusLabel={providerStatusLabel}
              onOpenHistory={() => setHistoryOpen(true)}
              onModelChange={setModel}
              onUseCaseChange={setUseCase}
              onSensitivityChange={setSensitivity}
              onThinkingChange={setThinkingMode}
              onToolsOpenChange={setToolsOpen}
              onToggleTool={handleToggleTool}
              onToggleGovernance={() => setGovernanceCollapsed((value) => !value)}
            />
            <ChatThread messages={messages} onStarterSelect={handleStarterSelect} />
            <ChatComposer
              input={input}
              attachments={attachments}
              sendDisabled={sendDisabled}
              isSending={isSending}
              isUploadingAttachment={isUploadingAttachment}
              attachmentError={attachmentError}
              contentSupportWarning={contentSupportWarning}
              gatewayError={error}
              risk={risk}
              activeWarning={activeWarning}
              redactionExplanation={getRedactionExplanation(risk)}
              showRedactionExplanation={showRedactionExplanation}
              onInputChange={(value) => {
                setInput(value);
                setWarningDismissed(false);
                setShowRedactionExplanation(false);
                setGatewayResult(null);
                setError(null);
              }}
              onSubmit={handleSubmit}
              onUploadAttachment={handleUploadAttachment}
              onRemoveAttachment={(id) => setAttachments((current) => current.filter((item) => item.id !== id))}
              onOpenVoice={() => setVoiceOpen(true)}
              onSendRedacted={() => void handleSubmit()}
              onEditMessage={handleEditMessage}
              onToggleRedactionExplanation={() => setShowRedactionExplanation((value) => !value)}
              onDismissGatewayError={() => setError(null)}
            />
          </div>
        </section>

        <GovernancePanel
          risk={risk}
          redactedPreview={gatewayResult?.redactedPromptPreview}
          redactions={gatewayResult?.governanceContext.redactions.map((redaction) => redaction.placeholder)}
          redactionSummary={gatewayResult?.redactionSummary}
          model={gatewayResult?.provider.selectedModel || selectedModelEntry.label}
          provider={gatewayResult?.provider.label || providerLabel(selectedModelEntry.provider)}
          capabilities={selectedModelEntry.capabilities}
          attachments={governanceAttachments}
          contentSupportWarning={contentSupportWarning}
          collapsed={governanceCollapsed}
          onToggleCollapsed={() => setGovernanceCollapsed((value) => !value)}
          onSendRedacted={() => void handleSubmit()}
          onEditMessage={handleEditMessage}
          onCancel={handleCancelWarning}
        />
      </div>

      <div className={cn("2xl:hidden", governanceCollapsed ? "hidden" : "block")}>
        <div className="mx-3 mb-3 rounded-2xl border border-accord-border bg-white p-3 shadow-accord-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accord-primary">Governance</p>
              <p className="text-sm font-semibold text-accord-text">
                {risk.decision} / {risk.score} risk score
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGovernanceCollapsed(true)}
              className="rounded-xl border border-accord-border px-3 py-2 text-xs font-semibold text-accord-text"
            >
              Hide
            </button>
          </div>
        </div>
      </div>

      {voiceOpen ? (
        <VoiceModePanel state={voiceState} onStateChange={setVoiceState} onClose={() => setVoiceOpen(false)} />
      ) : null}
    </div>
  );
}
