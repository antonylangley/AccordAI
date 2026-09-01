import { inflateRawSync, inflateSync } from "node:zlib";

export type ExtractedPolicyDocument = {
  fileType: "pdf" | "docx" | "doc" | "text";
  text: string;
  warnings: string[];
  blocks: PolicyDocumentTextBlock[];
  properties: Record<string, string>;
  extractionKind: "native" | "best_effort" | "ocr_required";
  hasNativeTextLayer: boolean;
  ocrFallbackRequired: boolean;
};

export type PolicyDocumentTextBlock = {
  text: string;
  kind: "title" | "heading" | "paragraph" | "table_row" | "property" | "pdf_text";
  source: "body" | "header" | "footer" | "footnote" | "endnote" | "core_properties";
  style?: string;
  level?: number;
  page?: number;
  fontSize?: number;
  x?: number;
  y?: number;
  cells?: string[];
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
    const { text, warnings, blocks, properties } = extractDocxText(buffer);
    const normalizedText = normalizeExtractedText(text);
    return {
      fileType: "docx",
      text: normalizedText,
      warnings,
      blocks: normalizeBlocks(blocks),
      properties,
      extractionKind: normalizedText.length ? "native" : "best_effort",
      hasNativeTextLayer: Boolean(normalizedText),
      ocrFallbackRequired: false
    };
  }

  if (lowerName.endsWith(".doc") || lowerType.includes("msword")) {
    const { text, warnings } = extractLegacyDocText(buffer);
    const normalizedText = normalizeExtractedText(text);
    return {
      fileType: "doc",
      text: normalizedText,
      warnings,
      blocks: textBlocksFromPlainText(normalizedText),
      properties: {},
      extractionKind: "best_effort",
      hasNativeTextLayer: Boolean(normalizedText),
      ocrFallbackRequired: false
    };
  }

  if (lowerName.endsWith(".pdf") || lowerType.includes("pdf")) {
    const { text, warnings, blocks, extractionKind, hasNativeTextLayer, ocrFallbackRequired } = extractPdfText(buffer);
    const normalizedText = normalizeExtractedText(text);
    return {
      fileType: "pdf",
      text: normalizedText,
      warnings,
      blocks: normalizeBlocks(blocks.length ? blocks : textBlocksFromPlainText(normalizedText, 1, "pdf_text")),
      properties: {},
      extractionKind,
      hasNativeTextLayer,
      ocrFallbackRequired
    };
  }

  if (lowerName.endsWith(".txt") || lowerName.endsWith(".md") || lowerType.startsWith("text/")) {
    const text = normalizeExtractedText(buffer.toString("utf8"));
    return {
      fileType: "text",
      text,
      warnings: [],
      blocks: textBlocksFromPlainText(text),
      properties: {},
      extractionKind: "native",
      hasNativeTextLayer: Boolean(text),
      ocrFallbackRequired: false
    };
  }

  throw new Error("Unsupported file type. Upload a PDF, DOCX, DOC, TXT, or Markdown policy document.");
}

function extractDocxText(buffer: Buffer) {
  const warnings: string[] = [];
  const entries = readZipEntries(buffer);
  const blocks: PolicyDocumentTextBlock[] = [];
  const properties = readDocxProperties(buffer, entries, warnings);
  const textParts: string[] = [];

  const documentEntry = entries.find((item) => item.name === "word/document.xml");
  if (documentEntry) {
    try {
      const documentXml = readZipEntry(buffer, documentEntry);
      const documentBlocks = docxBodyBlocks(documentXml);
      blocks.push(...documentBlocks);
      textParts.push(documentBlocks.map((block) => block.text).join("\n"));
    } catch {
      warnings.push("Could not read word/document.xml from the DOCX.");
    }
  }

  for (const [name, source] of [
    ["word/footnotes.xml", "footnote"],
    ["word/endnotes.xml", "endnote"],
    ["word/header1.xml", "header"],
    ["word/header2.xml", "header"],
    ["word/footer1.xml", "footer"],
    ["word/footer2.xml", "footer"]
  ] as Array<[string, PolicyDocumentTextBlock["source"]]>) {
    const entry = entries.find((item) => item.name === name);
    if (!entry) continue;

    try {
      const text = xmlToText(readZipEntry(buffer, entry)).trim();
      if (text) {
        textParts.push(text);
        blocks.push(...textBlocksFromPlainText(text, undefined, "paragraph", source));
      }
    } catch {
      warnings.push(`Could not read ${name} from the DOCX.`);
    }
  }

  if (properties.title) {
    blocks.unshift({
      text: properties.title,
      kind: "property",
      source: "core_properties",
      style: "dc:title"
    });
  }
  if (properties.subject) {
    blocks.unshift({
      text: properties.subject,
      kind: "property",
      source: "core_properties",
      style: "dc:subject"
    });
  }
  if (properties.description) {
    blocks.unshift({
      text: properties.description,
      kind: "property",
      source: "core_properties",
      style: "dc:description"
    });
  }

  if (!textParts.some(Boolean)) warnings.push("No readable text was found in the DOCX.");
  return { text: textParts.join("\n\n"), warnings, blocks, properties };
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

function readDocxProperties(buffer: Buffer, entries: ZipEntry[], warnings: string[]): Record<string, string> {
  const entry = entries.find((item) => item.name === "docProps/core.xml");
  if (!entry) return {};

  try {
    const xml = readZipEntry(buffer, entry);
    const properties = {
      title: readXmlElement(xml, "dc:title"),
      subject: readXmlElement(xml, "dc:subject"),
      description: readXmlElement(xml, "dc:description"),
      creator: readXmlElement(xml, "dc:creator"),
      lastModifiedBy: readXmlElement(xml, "cp:lastModifiedBy"),
      created: readXmlElement(xml, "dcterms:created"),
      modified: readXmlElement(xml, "dcterms:modified")
    };
    return Object.fromEntries(Object.entries(properties).filter(([, value]) => value)) as Record<string, string>;
  } catch {
    warnings.push("Could not read DOCX document properties.");
    return {};
  }
}

function docxBodyBlocks(xml: string): PolicyDocumentTextBlock[] {
  const blocks: PolicyDocumentTextBlock[] = [];
  const blockRegex = /<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g;
  let match: RegExpExecArray | null;
  let rowIndex = 0;

  while ((match = blockRegex.exec(xml))) {
    const kind = match[1];
    const fragment = match[0];

    if (kind === "tbl") {
      const rowRegex = /<w:tr\b[\s\S]*?<\/w:tr>/g;
      let rowMatch: RegExpExecArray | null;

      while ((rowMatch = rowRegex.exec(fragment))) {
        const cells = docxTableCells(rowMatch[0]);
        if (!cells.length) continue;
        rowIndex += 1;
        blocks.push({
          text: cells.join("\t"),
          kind: "table_row",
          source: "body",
          cells,
          level: 0
        });
      }
      continue;
    }

    const text = xmlToText(fragment).trim();
    if (!text) continue;

    const style = docxParagraphStyle(fragment);
    const level = docxHeadingLevel(style, text);
    blocks.push({
      text,
      kind: docxBlockKind(style, text),
      source: "body",
      style,
      level
    });
  }

  return blocks;
}

function docxTableCells(rowXml: string) {
  const cells: string[] = [];
  const cellRegex = /<w:tc\b[\s\S]*?<\/w:tc>/g;
  let match: RegExpExecArray | null;

  while ((match = cellRegex.exec(rowXml))) {
    const text = xmlToText(match[0]).replace(/\s+/g, " ").trim();
    if (text) cells.push(text);
  }

  return cells;
}

function docxParagraphStyle(xml: string) {
  const match = xml.match(/<w:pStyle\b[^>]*(?:w:val|val)="([^"]+)"/);
  return match?.[1] || undefined;
}

function docxBlockKind(style: string | undefined, text: string): PolicyDocumentTextBlock["kind"] {
  const normalized = normalizeStyleName(style);
  if (normalized === "title") return "title";
  if (normalized.startsWith("heading") || looksLikeTextHeading(text)) return "heading";
  return "paragraph";
}

function docxHeadingLevel(style: string | undefined, text: string) {
  const normalized = normalizeStyleName(style);
  const match = normalized.match(/^heading(\d+)$/);
  if (match) return Number(match[1]);
  return looksLikeTextHeading(text) ? 1 : 0;
}

function normalizeStyleName(value: string | undefined) {
  return (value || "").toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function looksLikeTextHeading(value: string) {
  const clean = value.replace(/^(\d+(\.\d+)*[.)]?|[A-Za-z][.)]|[-*])\s+/, "").trim();
  if (clean.length < 3 || clean.length > 120) return false;
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(value)) return true;
  if (/^[A-Z][A-Z0-9 /&,-]{5,}$/.test(clean)) return true;
  return /^[A-Z][a-z]+(\s+[A-Z][a-z]+){0,7}:?$/.test(clean) && !/[.!?]$/.test(clean);
}

function readXmlElement(xml: string, tagName: string) {
  const escaped = tagName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? xmlToText(match[1]).trim() : "";
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

function extractPdfText(buffer: Buffer): Pick<ExtractedPolicyDocument, "text" | "warnings" | "blocks" | "extractionKind" | "hasNativeTextLayer" | "ocrFallbackRequired"> {
  const warnings: string[] = [];
  const parts: string[] = [];
  const blocks: PolicyDocumentTextBlock[] = [];
  const raw = buffer.toString("latin1");
  let cursor = 0;
  let page = 1;

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
    if (decoded) {
      const extracted = extractPdfTextOperators(decoded, page);
      if (extracted.text) parts.push(extracted.text);
      blocks.push(...extracted.blocks);
    }
    cursor = endStreamMarker + "endstream".length;
    page += 1;
  }

  const streamText = parts.join("\n");
  const fallback = extractPdfTextOperators(raw);
  const text = streamText.length > fallback.text.length ? streamText : fallback.text;
  const finalBlocks = blocks.length && streamText.length >= fallback.text.length ? blocks : fallback.blocks;
  const readableLength = text.trim().length;
  const ocrFallbackRequired = readableLength < 40 && raw.includes("%PDF");
  const extractionKind = ocrFallbackRequired ? "ocr_required" : readableLength >= 120 ? "native" : "best_effort";

  if (ocrFallbackRequired) {
    warnings.push("This PDF appears to be scanned or image-only. OCR is required before Accord can extract policy requirements.");
  } else if (readableLength < 120) {
    warnings.push("PDF text extraction was limited. Scanned or heavily encoded PDFs may need OCR in a later pass.");
  }

  return {
    text,
    warnings,
    blocks: finalBlocks,
    extractionKind,
    hasNativeTextLayer: readableLength >= 40,
    ocrFallbackRequired
  };
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

function extractPdfTextOperators(value: string, page?: number) {
  const chunks: string[] = [];
  const blocks: PolicyDocumentTextBlock[] = [];
  const textBlockRegex = /BT([\s\S]*?)ET/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = textBlockRegex.exec(value))) {
    const blockStrings = extractPdfStringMatches(blockMatch[1]).map((item) => ({
      ...item,
      page,
      fontSize: pdfFontSizeBefore(blockMatch?.[1] || "", item.index),
      position: pdfPositionBefore(blockMatch?.[1] || "", item.index)
    }));
    chunks.push(...blockStrings.map((item) => item.text));
    blocks.push(...pdfBlocksFromMatches(blockStrings));
  }

  if (!chunks.length) {
    const fallbackStrings = extractPdfStringMatches(value);
    chunks.push(...fallbackStrings.map((item) => item.text));
    blocks.push(...pdfBlocksFromMatches(fallbackStrings.map((item) => ({ ...item, page }))));
  }
  return { text: chunks.join("\n"), blocks };
}

function extractPdfStrings(value: string) {
  return extractPdfStringMatches(value).map((item) => item.text);
}

function extractPdfStringMatches(value: string) {
  const chunks: string[] = [];
  const matches: Array<{ text: string; index: number }> = [];
  const literalRegex = /\((?:\\.|[^\\)])*\)/g;
  const hexRegex = /<([0-9a-fA-F\s]{4,})>/g;
  let literalMatch: RegExpExecArray | null;
  let hexMatch: RegExpExecArray | null;

  while ((literalMatch = literalRegex.exec(value))) {
    const decoded = decodePdfLiteral(literalMatch[0].slice(1, -1));
    if (looksReadable(decoded)) matches.push({ text: decoded, index: literalMatch.index });
  }

  while ((hexMatch = hexRegex.exec(value))) {
    const decoded = decodePdfHex(hexMatch[1]);
    if (looksReadable(decoded)) matches.push({ text: decoded, index: hexMatch.index });
  }

  matches.sort((left, right) => left.index - right.index);
  chunks.push(...matches.map((match) => match.text));
  return matches;
}

function pdfBlocksFromMatches(
  matches: Array<{ text: string; page?: number; fontSize?: number; position?: { x?: number; y?: number } }>
): PolicyDocumentTextBlock[] {
  const blocks: PolicyDocumentTextBlock[] = [];

  for (const match of matches) {
    const text = match.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    blocks.push({
      text,
      kind: match.fontSize && match.fontSize >= 17 && text.length <= 140 ? "heading" : "pdf_text",
      source: "body",
      page: match.page,
      fontSize: match.fontSize,
      x: match.position?.x,
      y: match.position?.y
    });
  }

  return blocks;
}

function pdfFontSizeBefore(value: string, index: number) {
  const before = value.slice(0, index);
  const matches = Array.from(before.matchAll(/\/[A-Za-z0-9_.-]+\s+([0-9.]+)\s+Tf/g));
  const last = matches.at(-1);
  if (!last) return undefined;
  const fontSize = Number.parseFloat(last[1]);
  return Number.isFinite(fontSize) ? fontSize : undefined;
}

function pdfPositionBefore(value: string, index: number) {
  const before = value.slice(0, index);
  const matches = Array.from(before.matchAll(/([-0-9.]+)\s+([-0-9.]+)\s+(?:Td|TD)/g));
  const last = matches.at(-1);
  if (!last) return {};
  const x = Number.parseFloat(last[1]);
  const y = Number.parseFloat(last[2]);
  return {
    x: Number.isFinite(x) ? x : undefined,
    y: Number.isFinite(y) ? y : undefined
  };
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

function textBlocksFromPlainText(
  value: string,
  page?: number,
  kind: PolicyDocumentTextBlock["kind"] = "paragraph",
  source: PolicyDocumentTextBlock["source"] = "body"
): PolicyDocumentTextBlock[] {
  return value
    .split(/\n{1,2}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      text: line,
      kind: looksLikeTextHeading(line) ? "heading" : kind,
      source,
      page,
      level: looksLikeTextHeading(line) ? 1 : 0
    }));
}

function normalizeBlocks(blocks: PolicyDocumentTextBlock[]) {
  return blocks
    .map((block) => ({
      ...block,
      text: normalizeBlockText(block.text),
      cells: block.cells?.map(normalizeBlockText).filter(Boolean)
    }))
    .filter((block) => block.text.length > 0)
    .slice(0, 600);
}

function normalizeBlockText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
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
