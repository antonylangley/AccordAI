"use client";

import { FilePlus2, ImagePlus, Loader2, Mic, Paperclip, Send } from "lucide-react";
import { useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { cn } from "@/lib/utils";
import { AttachmentChip } from "./attachment-chip";
import type { Attachment, RiskState } from "./types";

type ChatComposerProps = {
  input: string;
  attachments: Attachment[];
  sendDisabled: boolean;
  isSending: boolean;
  isUploadingAttachment: boolean;
  attachmentError: string | null;
  contentSupportWarning: string | null;
  gatewayError: string | null;
  risk: RiskState;
  activeWarning: boolean;
  redactionExplanation: string;
  showRedactionExplanation: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUploadAttachment: (file: File) => void;
  onRemoveAttachment: (id: string | number) => void;
  onOpenVoice: () => void;
  onSendRedacted: () => void;
  onEditMessage: () => void;
  onToggleRedactionExplanation: () => void;
  onDismissGatewayError: () => void;
};

const acceptedTypes = ["TXT", "MD", "CSV", "PDF metadata", "DOCX metadata", "images", "code text"];

export function ChatComposer({
  input,
  attachments,
  sendDisabled,
  isSending,
  isUploadingAttachment,
  attachmentError,
  contentSupportWarning,
  gatewayError,
  risk,
  activeWarning,
  redactionExplanation,
  showRedactionExplanation,
  onInputChange,
  onSubmit,
  onUploadAttachment,
  onRemoveAttachment,
  onOpenVoice,
  onSendRedacted,
  onEditMessage,
  onToggleRedactionExplanation,
  onDismissGatewayError
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const blocked = activeWarning && risk.decision === "Block";
  const warningActive = activeWarning || Boolean(contentSupportWarning) || Boolean(attachmentError) || Boolean(gatewayError);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onUploadAttachment(file);
  }

  return (
    <form onSubmit={onSubmit} className="shrink-0 border-t border-accord-border bg-white/92 px-3 py-3 backdrop-blur-xl">
      <div
        className={cn(
          "mx-auto max-w-3xl rounded-2xl border bg-white p-2.5 shadow-sm transition",
          warningActive
            ? blocked || gatewayError
              ? "border-red-200 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]"
              : "border-accord-primary/30 shadow-[0_0_0_3px_rgba(98,91,255,0.08)]"
            : "border-accord-border"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.csv,.pdf,.docx,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileSelection}
          className="hidden"
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelection}
          className="hidden"
        />
        <input
          ref={codeInputRef}
          type="file"
          accept=".ts,.tsx,.js,.jsx,.json,.py,.yml,.yaml,.log,.txt,text/plain,application/json"
          onChange={handleFileSelection}
          className="hidden"
        />
        {attachments.length || isUploadingAttachment ? (
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {attachments.map((attachment) => (
            <AttachmentChip key={attachment.id} attachment={attachment} onRemove={onRemoveAttachment} />
          ))}
          {isUploadingAttachment ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f2ff] px-2.5 py-1 text-xs font-semibold text-accord-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Scanning upload
            </span>
          ) : null}
          </div>
        ) : null}

        {activeWarning ? (
          <div
            className={cn(
              "mb-2 rounded-xl border px-3 py-2 text-xs",
              blocked ? "border-red-200 bg-red-50 text-red-900" : "border-[#dedcff] bg-[#f6f5ff] text-accord-text"
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{blocked ? "Request blocked" : "Sensitive info detected"}</p>
                <p className="mt-0.5 text-[11px] leading-4 opacity-80">
                  {blocked
                    ? "Possible secret or unsafe instruction detected."
                    : "Identifiers will be redacted before sending."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!blocked ? (
                  <button
                    type="button"
                    onClick={onSendRedacted}
                    className="rounded-full bg-accord-night px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    Send redacted
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onToggleRedactionExplanation}
                  className="rounded-full border border-current/20 px-2.5 py-1 text-[11px] font-semibold"
                >
                  Why?
                </button>
                <button
                  type="button"
                  onClick={onEditMessage}
                  className="rounded-full border border-current/20 px-2.5 py-1 text-[11px] font-semibold"
                >
                  Edit
                </button>
              </div>
            </div>
            {showRedactionExplanation ? (
              <p className="mt-2 border-t border-current/10 pt-2 text-[11px] leading-4 opacity-80">{redactionExplanation}</p>
            ) : null}
          </div>
        ) : null}

        {contentSupportWarning ? (
          <p className="mb-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-medium text-orange-900">
            {contentSupportWarning}
          </p>
        ) : null}
        {attachments.some((attachment) => attachment.visualScanLimited) ? (
          <p className="mb-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-medium text-orange-900">
            Images may contain visual sensitive data. Accord logs metadata and routes image content only through the selected model.
          </p>
        ) : null}
        {attachments.some((attachment) => attachment.flags?.length) ? (
          <p className="mb-2 rounded-xl border border-[#dfe4ff] bg-[#f5f6ff] px-3 py-1.5 text-[11px] font-medium text-accord-muted">
            Attachment text was scanned. Sensitive document text is redacted before provider routing; detected secrets will block sending.
          </p>
        ) : null}
        {attachmentError ? (
          <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-800">
            {attachmentError}
          </p>
        ) : null}
        {gatewayError ? (
          <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-800">
            <span>{gatewayError}</span>
            <button type="button" onClick={onDismissGatewayError} className="shrink-0 font-semibold underline">
              Dismiss
            </button>
          </div>
        ) : null}

        <label className="sr-only" htmlFor="chat-input">
          Message Accord
        </label>
        <textarea
          id="chat-input"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          disabled={isSending}
          rows={2}
          className="max-h-36 min-h-14 w-full resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm leading-6 text-accord-text outline-none placeholder:text-slate-400"
          placeholder="Message Accord..."
        />

        <div className="flex flex-col gap-2 border-t border-accord-border/70 pt-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAttachment}
              className="rounded-full border border-accord-border bg-accord-mist p-1.5 text-accord-muted transition hover:text-accord-text disabled:opacity-50"
              aria-label="Attach file"
            >
              <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingAttachment}
              className="rounded-full border border-accord-border bg-accord-mist p-1.5 text-accord-muted transition hover:text-accord-text disabled:opacity-50"
              aria-label="Attach image"
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => codeInputRef.current?.click()}
              disabled={isUploadingAttachment}
              className="rounded-full border border-accord-border bg-accord-mist p-1.5 text-accord-muted transition hover:text-accord-text disabled:opacity-50"
              aria-label="Attach code file"
            >
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onOpenVoice}
              className="rounded-full border border-accord-border bg-accord-mist p-1.5 text-accord-muted transition hover:text-accord-text"
              aria-label="Voice input"
            >
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <button
            type="submit"
            disabled={sendDisabled}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accord-night px-3 py-2 text-xs font-semibold text-white shadow-accord-glow transition hover:bg-accord-elevated disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSending ? "Scanning" : "Send"}
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <div className="mx-auto mt-1.5 flex max-w-3xl flex-wrap items-center justify-between gap-2 px-2 text-[11px] text-accord-muted">
        <div className="flex flex-wrap gap-1.5">
          {["Auto-redact on", "Metadata logged", "Raw disabled"].map((item) => (
            <span key={item} className="rounded-full bg-white/65 px-1.5 py-0.5">
              {item}
            </span>
          ))}
        </div>
        <span className="truncate">Accepts {acceptedTypes.join(", ")}</span>
      </div>
    </form>
  );
}
