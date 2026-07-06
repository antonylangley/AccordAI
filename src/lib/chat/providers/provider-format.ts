import "server-only";

import type { ChatContentPart, ChatProviderMessage } from "../types";

export function contentPartsToText(parts: ChatContentPart[]) {
  return parts
    .map((part) => {
      if (part.type === "text") return part.text;
      if (part.type === "document_text") {
        return `Attached document ${part.name || "document"} was extracted and redacted:\n${part.text}`;
      }
      if (part.type === "file_metadata") {
        const flags = part.flags?.length ? part.flags.join(", ") : "none";
        return `Attachment metadata: ${part.name} (${part.mimeType}, ${part.size} bytes, kind=${part.kind}, extraction=${part.extractionStatus || "metadata"}, flags=${flags}).`;
      }
      return `Image attachment ${part.name || "image"} (${part.mimeType}) included. Visual sensitive-data redaction is limited.`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function collectSystemText(messages: ChatProviderMessage[]) {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => contentPartsToText(message.content))
    .join("\n\n");
}

export function nonSystemMessages(messages: ChatProviderMessage[]) {
  return messages.filter((message) => message.role !== "system");
}
