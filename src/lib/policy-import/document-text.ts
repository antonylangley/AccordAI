import { inflateRawSync, inflateSync } from "node:zlib";

export type ExtractedPolicyDocument = {
  fileType: "pdf" | "docx" | "doc" | "text";
  text: string;
  warnings: string[];
};

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const maxExtractedCharacters = 80_000;

export async function extractPolicyDocumentText({
  buffer,
  fileName,
  contentType
}: {
  buffer: Buffer;
  fileName: string;
  contentType?: string;
}): Promise<ExtractedPolicyDocument> {
  const lowerName = fileName.toLowerCase();
  const lowerType = (contentType || "").toLowerCase();

  if (lowerName.endsWith(".docx") || lowerType.includes("wordprocessingml")) {
    const { text, warnings } = extractDocxText(buffer);
    return { fileType: "docx", text: normalizeExtractedText(text), warnings };
  }

  if (lowerName.endsWith(".doc") || lowerType.includes("msword")) {
    const { text, warnings } = extractLegacyDocText(buffer);
    return { fileType: "doc", text: normalizeExtractedText(text), warnings };
  }

  if (lowerName.endsWith(".pdf") || lowerType.includes("pdf")) {
    const { text, warnings } = extractPdfText(buffer);
    return { fileType: "pdf", text: normalizeExtractedText(text), warnings };
  }

  if (lowerName.endsWith(".txt") || lowerName.endsWith(".md") || lowerType.startsWith("text/")) {
    return {
      fileType: "text",
      text: normalizeExtractedText(buffer.toString("utf8")),
      warnings: []
    };
  }

  throw new Error("Unsupported file type. Upload a PDF, DOCX, DOC, TXT, or Markdown policy document.");
}

function extractDocxText(buffer: Buffer) {
  const warnings: string[] = [];
  const entries = readZipEntries(buffer);
  const textParts: string[] = [];

  for (const name of [
    "word/document.xml",
    "word/footnotes.xml",
    "word/endnotes.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/footer1.xml",
    "word/footer2.xml"
  ]) {
    const entry = entries.find((item) => item.name === name);
    if (!entry) continue;

    try {
      textParts.push(xmlToText(readZipEntry(buffer, entry)));
    } catch {
      warnings.push(`Could not read ${name} from the DOCX.`);
    }
  }

  if (!textParts.some(Boolean)) warnings.push("No readable text was found in the DOCX.");
  return { text: textParts.join("\n\n"), warnings };
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  const searchStart = Math.max(0, buffer.length - 66_000);

  for (let index = buffer.length - 22; index >= searchStart; index -= 1) {
    if (buffer.readUInt32LE(index) === eocdSignature) {
      eocdOffset = index;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error("Could not read the DOCX zip directory.");

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    entries.push({ name, method, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error("Invalid local zip header.");

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) return compressed.toString("utf8");
  if (entry.method === 8) return inflateRawSync(compressed).toString("utf8");

  throw new Error(`Unsupported DOCX compression method ${entry.method}.`);
}

function xmlToText(xml: string) {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\s*\/>/g, "\t")
      .replace(/<w:br\s*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<[^>]+>/g, "")
  );
}

function extractLegacyDocText(buffer: Buffer) {
  const latinText = printableRuns(buffer.toString("latin1"));
  const utf16Text = printableRuns(buffer.toString("utf16le"));
  const text = utf16Text.length > latinText.length ? utf16Text : latinText;

  return {
    text,
    warnings: ["Legacy .doc extraction is best effort. Save as DOCX or PDF if important policy text is missing."]
  };
}

function printableRuns(value: string) {
  return value
    .replace(/[^\t\n\r -~]+/g, " ")
    .split(/\s{2,}/)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk.length >= 18 && /[a-zA-Z]{4}/.test(chunk))
    .join("\n");
}

function extractPdfText(buffer: Buffer) {
  const warnings: string[] = [];
  const parts: string[] = [];
  const raw = buffer.toString("latin1");
  let cursor = 0;

  while (cursor < buffer.length) {
    const streamMarker = buffer.indexOf("stream", cursor, "latin1");
    if (streamMarker < 0) break;

    const endStreamMarker = buffer.indexOf("endstream", streamMarker, "latin1");
    if (endStreamMarker < 0) break;

    const dictionaryStart = raw.lastIndexOf("<<", streamMarker);
    const dictionaryEnd = raw.lastIndexOf(">>", streamMarker);
    const dictionary = dictionaryStart >= 0 && dictionaryEnd > dictionaryStart ? raw.slice(dictionaryStart, dictionaryEnd + 2) : "";
    let dataStart = streamMarker + "stream".length;
    if (buffer[dataStart] === 13 && buffer[dataStart + 1] === 10) dataStart += 2;
    else if (buffer[dataStart] === 10 || buffer[dataStart] === 13) dataStart += 1;

    let dataEnd = endStreamMarker;
    while (dataEnd > dataStart && (buffer[dataEnd - 1] === 10 || buffer[dataEnd - 1] === 13)) dataEnd -= 1;

    const stream = buffer.subarray(dataStart, dataEnd);
    const decoded = decodePdfStream(stream, dictionary, warnings);
    if (decoded) parts.push(extractPdfTextOperators(decoded));
    cursor = endStreamMarker + "endstream".length;
  }

  const streamText = parts.join("\n");
  const fallbackText = extractPdfTextOperators(raw);
  const text = streamText.length > fallbackText.length ? streamText : fallbackText;

  if (text.trim().length < 120) {
    warnings.push("PDF text extraction was limited. Scanned or heavily encoded PDFs may need OCR in a later pass.");
  }

  return { text, warnings };
}

function decodePdfStream(stream: Buffer, dictionary: string, warnings: string[]) {
  try {
    if (/\/FlateDecode\b/.test(dictionary)) {
      try {
        return inflateSync(stream).toString("latin1");
      } catch {
        return inflateRawSync(stream).toString("latin1");
      }
    }

    if (/\/DCTDecode\b|\/JPXDecode\b|\/CCITTFaxDecode\b/.test(dictionary)) return "";
    return stream.toString("latin1");
  } catch {
    warnings.push("A compressed PDF stream could not be decoded.");
    return "";
  }
}

function extractPdfTextOperators(value: string) {
  const chunks: string[] = [];
  const textBlockRegex = /BT([\s\S]*?)ET/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = textBlockRegex.exec(value))) {
    chunks.push(...extractPdfStrings(blockMatch[1]));
  }

  if (!chunks.length) chunks.push(...extractPdfStrings(value));
  return chunks.join(" ");
}

function extractPdfStrings(value: string) {
  const chunks: string[] = [];
  const literalRegex = /\((?:\\.|[^\\)])*\)/g;
  const hexRegex = /<([0-9a-fA-F\s]{4,})>/g;
  let literalMatch: RegExpExecArray | null;
  let hexMatch: RegExpExecArray | null;

  while ((literalMatch = literalRegex.exec(value))) {
    const decoded = decodePdfLiteral(literalMatch[0].slice(1, -1));
    if (looksReadable(decoded)) chunks.push(decoded);
  }

  while ((hexMatch = hexRegex.exec(value))) {
    const decoded = decodePdfHex(hexMatch[1]);
    if (looksReadable(decoded)) chunks.push(decoded);
  }

  return chunks;
}

function decodePdfLiteral(value: string) {
  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      output += char;
      continue;
    }

    const next = value[index + 1];
    index += 1;

    if (next === "n") output += "\n";
    else if (next === "r") output += "\r";
    else if (next === "t") output += "\t";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next === "(" || next === ")" || next === "\\") output += next;
    else if (/[0-7]/.test(next || "")) {
      const octal = `${next}${value.slice(index + 1, index + 3).match(/^[0-7]{0,2}/)?.[0] || ""}`;
      output += String.fromCharCode(parseInt(octal, 8));
      index += octal.length - 1;
    }
  }

  return output;
}

function decodePdfHex(value: string) {
  const clean = value.replace(/\s+/g, "");
  if (clean.length < 4 || clean.length % 2 !== 0) return "";
  const bytes = Buffer.from(clean, "hex");

  if (bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16Be(bytes.subarray(2));
  return bytes.toString("utf8");
}

function decodeUtf16Be(buffer: Buffer) {
  let output = "";
  for (let index = 0; index + 1 < buffer.length; index += 2) {
    output += String.fromCharCode(buffer.readUInt16BE(index));
  }
  return output;
}

function looksReadable(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 2) return false;
  const readableCharacters = trimmed.match(/[a-zA-Z0-9.,;:!?@/#$%&()[\]\s-]/g)?.length || 0;
  return readableCharacters / trimmed.length > 0.65;
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, maxExtractedCharacters);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
