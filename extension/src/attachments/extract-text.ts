import {
  getFileExtension,
  isExtractableDocumentAttachment,
  MAX_GUARDED_DOCUMENT_ATTACHMENT_BYTES
} from "./policy";
import type { AttachmentExtractionKind } from "./policy";

const MAX_EXTRACTED_TEXT_CHARS = 160_000;
const textDecoder = new TextDecoder("utf-8", { fatal: false });
const binaryDecoder = new TextDecoder("latin1", { fatal: false });

export type AttachmentTextExtraction =
  | {
      status: "extracted";
      kind: AttachmentExtractionKind;
      text: string;
      warnings: string[];
    }
  | {
      status: "unsupported" | "too_large" | "failed";
      kind?: AttachmentExtractionKind;
      reason: string;
      warnings: string[];
    };

export async function extractGovernableAttachmentText(file: File): Promise<AttachmentTextExtraction> {
  if (!isExtractableDocumentAttachment(file.name, file.type)) {
    return {
      status: "unsupported",
      reason: "This file type is not supported for browser-mode text extraction.",
      warnings: []
    };
  }

  const extension = getFileExtension(file.name);
  const kind = extension === "pdf" ? "pdf_text" : "docx_text";

  if (file.size > MAX_GUARDED_DOCUMENT_ATTACHMENT_BYTES) {
    return {
      status: "too_large",
      kind,
      reason: "This document is too large for browser-mode extraction.",
      warnings: []
    };
  }

  try {
    const buffer = await file.arrayBuffer();
    const extracted = kind === "pdf_text" ? await extractPdfText(buffer) : await extractDocxText(buffer);

    if (!extracted.text.trim()) {
      return {
        status: "failed",
        kind,
        reason:
          kind === "pdf_text"
            ? "Accord could not extract readable text from this PDF in browser mode."
            : "Accord could not extract readable text from this DOCX in browser mode.",
        warnings: extracted.warnings
      };
    }

    return {
      status: "extracted",
      kind,
      text: extracted.text,
      warnings: extracted.warnings
    };
  } catch (error) {
    return {
      status: "failed",
      kind,
      reason: error instanceof Error ? error.message : "Accord could not extract document text in browser mode.",
      warnings: []
    };
  }
}

async function extractPdfText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const binary = binaryDecoder.decode(bytes);
  const streams = await collectPdfStreamText(bytes, binary);
  const fallback = extractPdfTextObjects(binary);
  return finalizeExtractedText([...streams.textBlocks, fallback].filter(Boolean).join("\n\n"), streams.warnings);
}

async function collectPdfStreamText(bytes: Uint8Array, binary: string) {
  const textBlocks: string[] = [];
  const warnings: string[] = [];
  const streamPattern = /<<([\s\S]*?)>>\s*stream\r?\n?/g;
  let match: RegExpExecArray | null;

  while ((match = streamPattern.exec(binary))) {
    const dictionary = match[1] || "";
    const streamStart = streamPattern.lastIndex;
    const endIndex = binary.indexOf("endstream", streamStart);
    if (endIndex < 0) break;

    let streamEnd = endIndex;
    while (streamEnd > streamStart && (binary[streamEnd - 1] === "\n" || binary[streamEnd - 1] === "\r")) {
      streamEnd -= 1;
    }

    const streamBytes = bytes.slice(streamStart, streamEnd);
    const decoded = dictionary.includes("FlateDecode") ? await inflatePdfStream(streamBytes) : streamBytes;
    if (!decoded) {
      warnings.push("A compressed PDF stream could not be decompressed in browser mode.");
      streamPattern.lastIndex = endIndex + "endstream".length;
      continue;
    }

    const text = extractPdfTextObjects(binaryDecoder.decode(decoded));
    if (text) textBlocks.push(text);
    streamPattern.lastIndex = endIndex + "endstream".length;
  }

  return { textBlocks, warnings };
}

async function inflatePdfStream(bytes: Uint8Array) {
  return (
    (await decompress(bytes, "deflate")) ||
    (await decompress(bytes, "deflate-raw"))
  );
}

async function extractDocxText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const documentXml = await readZipTextFile(bytes, "word/document.xml");
  if (!documentXml) {
    return finalizeExtractedText("", ["DOCX document.xml was not found."]);
  }

  const paragraphs = documentXml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .split(/\n+/)
    .map((line) => decodeXmlEntities(line).replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean);

  return finalizeExtractedText(paragraphs.join("\n"), []);
}

async function readZipTextFile(bytes: Uint8Array, targetName: string) {
  const entry = findCentralDirectoryEntry(bytes, targetName) || findLocalFileEntry(bytes, targetName);
  if (!entry) return "";

  const fileBytes = entry.compressionMethod === 0 ? entry.data : await decompress(entry.data, "deflate-raw");
  if (!fileBytes) return "";

  return textDecoder.decode(fileBytes);
}

type ZipEntryData = {
  compressionMethod: number;
  data: Uint8Array;
};

function findCentralDirectoryEntry(bytes: Uint8Array, targetName: string): ZipEntryData | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  for (let offset = 0; offset <= bytes.length - 46; offset += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileName = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    if (fileName === targetName) {
      return readLocalFileData(bytes, localHeaderOffset, compressionMethod, compressedSize);
    }

    offset += 46 + fileNameLength + extraLength + commentLength - 1;
  }

  return null;
}

function findLocalFileEntry(bytes: Uint8Array, targetName: string): ZipEntryData | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset <= bytes.length - 30) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const fileName = textDecoder.decode(bytes.slice(offset + 30, offset + 30 + fileNameLength));

    if (fileName === targetName) {
      return readLocalFileData(bytes, offset, compressionMethod, compressedSize);
    }

    if (!compressedSize) break;
    offset = dataStart + compressedSize;
  }

  return null;
}

function readLocalFileData(bytes: Uint8Array, localHeaderOffset: number, compressionMethod: number, compressedSize: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (localHeaderOffset > bytes.length - 30 || view.getUint32(localHeaderOffset, true) !== 0x04034b50) return null;

  const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
  const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
  const dataEnd = dataStart + compressedSize;
  if (dataEnd > bytes.length) return null;

  return {
    compressionMethod,
    data: bytes.slice(dataStart, dataEnd)
  };
}

async function decompress(bytes: Uint8Array, format: "deflate" | "deflate-raw") {
  if (!("DecompressionStream" in globalThis)) return null;

  try {
    const chunk = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const stream = new Blob([chunk]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

function extractPdfTextObjects(content: string) {
  const sections = Array.from(content.matchAll(/BT([\s\S]*?)ET/g), (match) => match[1]).filter(Boolean);
  const sources = sections.length ? sections : [content];
  const lines: string[] = [];

  for (const source of sources) {
    const strings = collectPdfStrings(source);
    if (strings.length) lines.push(strings.join(" "));
  }

  return normalizeDocumentText(lines.join("\n"));
}

function collectPdfStrings(source: string) {
  const strings: string[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (char === "(") {
      const parsed = readPdfLiteralString(source, index);
      if (parsed) {
        strings.push(parsed.value);
        index = parsed.nextIndex;
        continue;
      }
    }

    if (char === "<" && source[index + 1] !== "<") {
      const end = source.indexOf(">", index + 1);
      if (end > index) {
        const decoded = decodePdfHexString(source.slice(index + 1, end));
        if (decoded) strings.push(decoded);
        index = end + 1;
        continue;
      }
    }

    index += 1;
  }

  return strings.map((value) => normalizeDocumentText(value)).filter(Boolean);
}

function readPdfLiteralString(source: string, start: number) {
  let depth = 0;
  let value = "";

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (index === start) {
      depth = 1;
      continue;
    }

    if (char === "\\") {
      const next = source[index + 1] || "";
      const escaped = decodePdfEscape(next, source.slice(index + 1, index + 4));
      value += escaped.value;
      index += escaped.consumed;
      continue;
    }

    if (char === "(") {
      depth += 1;
      value += char;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return {
          value,
          nextIndex: index + 1
        };
      }
      value += char;
      continue;
    }

    value += char;
  }

  return null;
}

function decodePdfEscape(next: string, lookahead: string) {
  const octal = lookahead.match(/^[0-7]{1,3}/)?.[0];
  if (octal) {
    return {
      value: String.fromCharCode(parseInt(octal, 8)),
      consumed: octal.length
    };
  }

  const escapes: Record<string, string> = {
    n: "\n",
    r: "\n",
    t: "\t",
    b: "\b",
    f: "\f",
    "(": "(",
    ")": ")",
    "\\": "\\"
  };

  return {
    value: escapes[next] ?? next,
    consumed: 1
  };
}

function decodePdfHexString(hex: string) {
  const clean = hex.replace(/\s+/g, "");
  if (!clean || clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return "";

  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < clean.length; index += 2) {
    bytes[index / 2] = parseInt(clean.slice(index, index + 2), 16);
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16Be(bytes.slice(2));
  }

  const mostlyUtf16Be = bytes.length >= 4 && bytes.filter((_, index) => index % 2 === 0 && bytes[index] === 0).length >= bytes.length / 4;
  if (mostlyUtf16Be) return decodeUtf16Be(bytes);

  return binaryDecoder.decode(bytes);
}

function decodeUtf16Be(bytes: Uint8Array) {
  let value = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    value += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
  }
  return value;
}

function finalizeExtractedText(text: string, warnings: string[]) {
  const normalized = normalizeDocumentText(text);
  if (normalized.length <= MAX_EXTRACTED_TEXT_CHARS) {
    return { text: normalized, warnings };
  }

  return {
    text: normalized.slice(0, MAX_EXTRACTED_TEXT_CHARS).trim(),
    warnings: [...warnings, "Extracted text was truncated before governance scanning."]
  };
}

function normalizeDocumentText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXmlEntities(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}
