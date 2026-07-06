"use client";

import { File, ImageIcon, X } from "lucide-react";
import type { Attachment } from "./types";

export function AttachmentChip({
  attachment,
  onRemove
}: {
  attachment: Attachment;
  onRemove: (id: string | number) => void;
}) {
  const Icon = attachment.kind === "image" || attachment.type === "Image" ? ImageIcon : File;
  const hasFlags = Boolean(attachment.flags?.length);
  const blocked = attachment.policyDecision?.action === "block";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-accord-border bg-white px-2.5 py-1 text-xs font-medium text-accord-text shadow-sm">
      <Icon className="h-3.5 w-3.5 text-accord-primary" aria-hidden="true" />
      <span className="max-w-40 truncate">{attachment.name}</span>
      <span className="rounded-full bg-accord-mist px-1.5 py-0.5 font-mono text-[10px] text-accord-muted">
        {attachment.type}
      </span>
      {attachment.visualScanLimited ? (
        <span className="rounded-full bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] text-orange-700">image note</span>
      ) : null}
      {hasFlags ? (
        <span className={blocked ? "rounded-full bg-red-50 px-1.5 py-0.5 font-mono text-[10px] text-red-700" : "rounded-full bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] text-orange-700"}>
          {blocked ? "blocked" : `${attachment.flags?.length} flags`}
        </span>
      ) : null}
      <button type="button" onClick={() => onRemove(attachment.id)} aria-label={`Remove ${attachment.name}`}>
        <X className="h-3.5 w-3.5 text-accord-muted" aria-hidden="true" />
      </button>
    </span>
  );
}
