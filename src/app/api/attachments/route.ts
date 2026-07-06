import { NextResponse } from "next/server";
import { decidePolicy, scanText } from "@/lib/chat/scanner";
import type { ChatAttachmentKind, ChatAttachmentMetadata } from "@/lib/chat/types";

export const runtime = "nodejs";

const maxUploadBytes = 5 * 1024 * 1024;
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const allowedTextTypes = new Set(["text/plain", "text/markdown", "text/csv", "application/csv", "application/json"]);
const metadataOnlyTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const textExtensions = new Set([".txt", ".md", ".csv", ".json", ".ts", ".tsx", ".js", ".jsx", ".py", ".yml", ".yaml", ".log"]);
const metadataOnlyExtensions = new Set([".pdf", ".docx"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("Upload must include a file field.", 400);
    }

    if (file.size <= 0) {
      return jsonError("File is empty.", 400);
    }

    if (file.size > maxUploadBytes) {
      return jsonError("File is too large. Accord accepts files up to 5 MB in this prototype.", 400);
    }

    const normalized = normalizeFile(file);

    if (normalized.kind === "unsupported") {
      return jsonError("Unsupported attachment type. Accord accepts TXT, MD, CSV, PDF, DOCX, PNG, JPG, JPEG, and WEBP.", 400);
    }

    const attachment = await buildAttachment(file, normalized.kind, normalized.mimeType, normalized.typeLabel);

    return NextResponse.json(
      { attachment },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Attachment upload failed.", 500);
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

async function buildAttachment(
  file: File,
  kind: ChatAttachmentKind,
  mimeType: string,
  typeLabel: string
): Promise<ChatAttachmentMetadata> {
  const baseAttachment: ChatAttachmentMetadata = {
    id: crypto.randomUUID(),
    name: file.name,
    type: typeLabel,
    kind,
    mimeType,
    size: file.size
  };

  if (kind === "image") {
    const buffer = Buffer.from(await file.arrayBuffer());

    return {
      ...baseAttachment,
      data: buffer.toString("base64"),
      riskScore: 18,
      flags: [],
      visualScanLimited: true,
      extractionStatus: "extracted",
      policyDecision: {
        action: "warn",
        reason: "Images may contain visual sensitive data. Accord logs metadata and routes image content only through supported selected models.",
        requiresReview: false,
        providerCalled: false,
        redacted: false
      }
    };
  }

  if (kind === "metadata") {
    return {
      ...baseAttachment,
      riskScore: 10,
      flags: [],
      extractionStatus: "metadata_only_todo",
      policyDecision: {
        action: "allow",
        reason: "File metadata accepted. Text extraction for this format is marked TODO in this pass.",
        requiresReview: false,
        providerCalled: false,
        redacted: false
      }
    };
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(await file.arrayBuffer()).slice(0, 80_000);
  const scan = scanText(text, "attachment", "Internal");
  const policyDecision = decidePolicy(scan);

  return {
    ...baseAttachment,
    redactedText: scan.redactedText,
    riskScore: scan.riskScore,
    flags: scan.flags,
    redactions: scan.redactions,
    extractionStatus: policyDecision.action === "block" ? "blocked" : "extracted",
    policyDecision
  };
}

function normalizeFile(file: File):
  | {
      kind: ChatAttachmentKind;
      mimeType: string;
      typeLabel: string;
    }
  | {
      kind: "unsupported";
    } {
  const extension = getExtension(file.name);
  const mimeType = file.type || mimeTypeFromExtension(extension);

  if (allowedImageTypes.has(mimeType) && imageExtensions.has(extension)) {
    return {
      kind: "image",
      mimeType,
      typeLabel: "Image"
    };
  }

  if (allowedTextTypes.has(mimeType) || textExtensions.has(extension)) {
    return {
      kind: "text",
      mimeType,
      typeLabel: labelForTextExtension(extension)
    };
  }

  if (metadataOnlyTypes.has(mimeType) || metadataOnlyExtensions.has(extension)) {
    return {
      kind: "metadata",
      mimeType,
      typeLabel: extension === ".docx" ? "DOCX" : "PDF"
    };
  }

  return { kind: "unsupported" };
}

function getExtension(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function mimeTypeFromExtension(extension: string) {
  const mimeTypes: Record<string, string> = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json",
    ".ts": "text/plain",
    ".tsx": "text/plain",
    ".js": "text/plain",
    ".jsx": "text/plain",
    ".py": "text/plain",
    ".yml": "text/plain",
    ".yaml": "text/plain",
    ".log": "text/plain",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  };

  return mimeTypes[extension] || "application/octet-stream";
}

function labelForTextExtension(extension: string) {
  if (extension === ".csv") return "CSV";
  if (extension === ".md") return "MD";
  if (extension === ".json" || extension === ".ts" || extension === ".tsx" || extension === ".js" || extension === ".jsx" || extension === ".py") {
    return "Code";
  }

  return "TXT";
}
