export const MAX_GUARDED_TEXT_ATTACHMENT_BYTES = 256 * 1024;

export const supportedTextAttachmentExtensions = new Set([
  "bash",
  "c",
  "cc",
  "cpp",
  "csv",
  "h",
  "hpp",
  "ini",
  "java",
  "js",
  "json",
  "jsx",
  "md",
  "py",
  "sh",
  "sql",
  "toml",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml"
]);

const textMimePrefixes = ["text/"];
const explicitlyUnsupportedMimePrefixes = ["audio/", "image/", "video/"];
const supportedMimeTypes = new Set([
  "application/csv",
  "application/json",
  "application/javascript",
  "application/sql",
  "application/typescript",
  "application/x-csh",
  "application/x-httpd-php",
  "application/x-javascript",
  "application/x-python-code",
  "application/x-sh",
  "application/x-shellscript",
  "application/x-sql",
  "application/x-toml",
  "application/x-typescript",
  "application/x-yaml",
  "application/xml",
  "application/yaml",
  "application/vnd.ms-excel"
]);
const genericMimeTypes = new Set([
  "application/octet-stream",
  "application/binary",
  "application/x-binary",
  "application/x-empty",
  "application/x-unknown",
  "application/unknown",
  "binary/octet-stream"
]);
const explicitlyUnsupportedMimeTypes = new Set([
  "application/gzip",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/x-7z-compressed",
  "application/x-msdownload",
  "application/x-rar-compressed",
  "application/zip"
]);

export type AttachmentContentClassification =
  | "supported_text"
  | "unsupported_type"
  | "unsupported_mime"
  | "too_large"
  | "read_failed"
  | "binary_content";

export type AttachmentDescriptor = {
  name: string;
  mimeType: string;
  size: number;
};

export function getFileExtension(name: string) {
  const cleanName = name.split(/[\\/]/).pop() || name;
  const dotIndex = cleanName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === cleanName.length - 1) return cleanName.toLocaleLowerCase() === "bash" ? "bash" : "";
  return cleanName.slice(dotIndex + 1).toLocaleLowerCase();
}

export function isSupportedTextAttachment(name: string, mimeType: string) {
  const extension = getFileExtension(name);
  if (!supportedTextAttachmentExtensions.has(extension)) return false;
  return isCandidateTextMime(mimeType);
}

export function classifyAttachmentContent(descriptor: AttachmentDescriptor, text?: string): AttachmentContentClassification {
  const extension = getFileExtension(descriptor.name);
  if (!supportedTextAttachmentExtensions.has(extension)) return "unsupported_type";
  if (!isCandidateTextMime(descriptor.mimeType)) return "unsupported_mime";
  if (descriptor.size > MAX_GUARDED_TEXT_ATTACHMENT_BYTES) return "too_large";
  if (typeof text !== "string") return "read_failed";
  if (looksLikeBinaryText(text)) return "binary_content";
  return "supported_text";
}

export function splitFileName(name: string) {
  const cleanName = name.split(/[\\/]/).pop() || "attachment";
  const dotIndex = cleanName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === cleanName.length - 1) {
    return {
      stem: cleanName,
      extension: ""
    };
  }

  return {
    stem: cleanName.slice(0, dotIndex),
    extension: cleanName.slice(dotIndex)
  };
}

export function safeMimeType(mimeType: string, name: string) {
  if (mimeType && isSupportedTextAttachment(name, mimeType) && !isGenericMime(mimeType)) return normalizeMimeType(mimeType);
  const extension = getFileExtension(name);
  if (extension === "json") return "application/json";
  if (extension === "xml") return "application/xml";
  if (extension === "js" || extension === "jsx") return "application/javascript";
  if (extension === "ts" || extension === "tsx") return "application/typescript";
  if (extension === "csv") return "text/csv";
  if (extension === "md") return "text/markdown";
  if (extension === "py") return "text/x-python";
  if (extension === "yaml" || extension === "yml") return "application/x-yaml";
  return "text/plain";
}

export function mimeCategory(mimeType: string) {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return "unknown";
  if (textMimePrefixes.some((prefix) => normalized.startsWith(prefix))) return "text";
  if (genericMimeTypes.has(normalized)) return "generic";
  if (normalized.includes("json")) return "json";
  if (normalized.includes("xml")) return "xml";
  if (normalized.includes("yaml")) return "yaml";
  if (normalized.includes("javascript") || normalized.includes("typescript")) return "code";
  if (explicitlyUnsupportedMimeTypes.has(normalized) || explicitlyUnsupportedMimePrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return "unsupported";
  }
  return "application";
}

function isCandidateTextMime(mimeType: string) {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return true;
  if (textMimePrefixes.some((prefix) => normalized.startsWith(prefix))) return true;
  if (supportedMimeTypes.has(normalized)) return true;
  if (genericMimeTypes.has(normalized)) return true;
  if (explicitlyUnsupportedMimeTypes.has(normalized)) return false;
  if (explicitlyUnsupportedMimePrefixes.some((prefix) => normalized.startsWith(prefix))) return false;
  return /\b(?:csv|json|javascript|sql|toml|typescript|xml|yaml)\b/.test(normalized);
}

function isGenericMime(mimeType: string) {
  return genericMimeTypes.has(normalizeMimeType(mimeType));
}

function normalizeMimeType(mimeType: string) {
  return mimeType.split(";")[0]?.trim().toLocaleLowerCase() || "";
}

function looksLikeBinaryText(text: string) {
  if (!text) return false;
  if (text.includes("\u0000") || text.includes("\ufffd")) return true;

  let controlCount = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    const allowedWhitespace = code === 9 || code === 10 || code === 13;
    if ((code < 32 || (code >= 127 && code <= 159)) && !allowedWhitespace) {
      controlCount += 1;
    }
  }

  return controlCount / text.length > 0.02;
}
