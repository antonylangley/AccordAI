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
const supportedMimeTypes = new Set([
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/x-sh",
  "application/xml",
  "application/x-yaml"
]);

export function getFileExtension(name: string) {
  const cleanName = name.split(/[\\/]/).pop() || name;
  const dotIndex = cleanName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === cleanName.length - 1) return cleanName.toLocaleLowerCase() === "bash" ? "bash" : "";
  return cleanName.slice(dotIndex + 1).toLocaleLowerCase();
}

export function isSupportedTextAttachment(name: string, mimeType: string) {
  const extension = getFileExtension(name);
  if (!supportedTextAttachmentExtensions.has(extension)) return false;
  if (!mimeType) return true;
  return textMimePrefixes.some((prefix) => mimeType.startsWith(prefix)) || supportedMimeTypes.has(mimeType);
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
  if (mimeType && isSupportedTextAttachment(name, mimeType)) return mimeType;
  const extension = getFileExtension(name);
  if (extension === "json") return "application/json";
  if (extension === "xml") return "application/xml";
  if (extension === "js" || extension === "jsx") return "application/javascript";
  if (extension === "ts" || extension === "tsx") return "application/typescript";
  return "text/plain";
}
