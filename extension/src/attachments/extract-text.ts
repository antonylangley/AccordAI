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
  const kind: AttachmentExtractionKind =
    extension === "pdf"
      ? "pdf_text"
      : extension === "docx"
        ? "docx_text"
        : extension === "xlsx"
          ? "xlsx_text"
          : "pptx_text";

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
    const extracted =
      kind === "pdf_text"
        ? await extractPdfText(buffer)
        : kind === "docx_text"
          ? await extractDocxText(buffer)
          : kind === "xlsx_text"
            ? await extractXlsxText(buffer)
            : await extractPptxText(buffer);

    if (!extracted.text.trim()) {
      return {
        status: "failed",
        kind,
        reason: `Accord could not extract readable text from this ${sourceLabel(kind)} in browser mode.`,
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
  const fallback = extractPdfTextObjects(binary, streams.unicodeMap);
  return finalizeExtractedText([...streams.textBlocks, fallback].filter(Boolean).join("\n\n"), streams.warnings);
}

async function collectPdfStreamText(bytes: Uint8Array, binary: string) {
  const streamSources: string[] = [];
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

    streamSources.push(binaryDecoder.decode(decoded));
    streamPattern.lastIndex = endIndex + "endstream".length;
  }

  const unicodeMap = collectPdfUnicodeMap(streamSources);
  const textBlocks = streamSources
    .filter((source) => /\bBT\b[\s\S]*?\bET\b/.test(source))
    .map((source) => extractPdfTextObjects(source, unicodeMap))
    .filter(Boolean);
  return { textBlocks, unicodeMap, warnings };
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

  const relatedParts = await Promise.all(
    listZipEntryNames(bytes)
      .filter((name) => /^word\/(?:header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(name))
      .map((name) => readZipTextFile(bytes, name))
  );
  const paragraphs = [documentXml, ...relatedParts]
    .filter(Boolean)
    .join("\n")
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

async function extractXlsxText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const warnings: string[] = [];
  const sharedStrings = parseSharedStrings(await readZipTextFile(bytes, "xl/sharedStrings.xml"));
  const workbookXml = await readZipTextFile(bytes, "xl/workbook.xml");
  const relationshipXml = await readZipTextFile(bytes, "xl/_rels/workbook.xml.rels");
  const sheetRelationships = parseWorkbookRelationships(relationshipXml);
  const declaredSheets = parseWorkbookSheets(workbookXml, sheetRelationships);
  const fallbackSheets = listZipEntryNames(bytes)
    .filter((name) => /^xl\/worksheets\/[^/]+\.xml$/i.test(name))
    .sort()
    .map((path, index) => ({ name: `Sheet ${index + 1}`, path }));
  const sheets = declaredSheets.length ? declaredSheets : fallbackSheets;

  if (!sheets.length) {
    return finalizeExtractedText("", ["XLSX worksheet XML was not found."]);
  }

  const output: string[] = [];
  for (const sheet of sheets) {
    const sheetXml = await readZipTextFile(bytes, sheet.path);
    if (!sheetXml) {
      warnings.push(`Worksheet ${sheet.name} could not be read.`);
      continue;
    }

    const rows = parseWorksheetRows(sheetXml, sharedStrings);
    if (!rows.length) continue;
    output.push(`Sheet: ${sheet.name}`, ...rows, "");
  }

  return finalizeExtractedText(output.join("\n"), warnings);
}

async function extractPptxText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const partNames = listZipEntryNames(bytes)
    .filter((name) => /^ppt\/(?:slides\/slide|notesSlides\/notesSlide)\d+\.xml$/i.test(name))
    .sort(naturalPartSort);
  if (!partNames.length) return finalizeExtractedText("", ["PPTX slide XML was not found."]);

  const output: string[] = [];
  for (const partName of partNames) {
    const xml = await readZipTextFile(bytes, partName);
    const text = extractXmlText(xml).replace(/[\t\r\n]+/g, " ").trim();
    if (!text) continue;
    const number = partName.match(/(\d+)\.xml$/)?.[1] || "";
    output.push(`${partName.includes("notesSlides") ? "Notes" : "Slide"} ${number}: ${text}`);
  }
  return finalizeExtractedText(output.join("\n"), []);
}

function naturalPartSort(first: string, second: string) {
  if (first.includes("notesSlides") !== second.includes("notesSlides")) {
    return first.includes("notesSlides") ? 1 : -1;
  }
  const firstNumber = Number.parseInt(first.match(/(\d+)\.xml$/)?.[1] || "0", 10);
  const secondNumber = Number.parseInt(second.match(/(\d+)\.xml$/)?.[1] || "0", 10);
  return firstNumber - secondNumber;
}

function parseSharedStrings(xml: string) {
  if (!xml) return [];
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi), (match) => extractXmlText(match[1] || ""));
}

function parseWorkbookRelationships(xml: string) {
  const relationships = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*?)\/?\s*>/gi)) {
    const attributes = parseXmlAttributes(match[1] || "");
    const id = attributes.Id || attributes.id;
    const target = attributes.Target || attributes.target;
    if (!id || !target) continue;
    relationships.set(id, normalizeZipPath("xl", target));
  }
  return relationships;
}

function parseWorkbookSheets(xml: string, relationships: Map<string, string>) {
  const sheets: Array<{ name: string; path: string }> = [];
  for (const match of xml.matchAll(/<sheet\b([^>]*?)\/?\s*>/gi)) {
    const attributes = parseXmlAttributes(match[1] || "");
    const relationshipId = attributes["r:id"] || attributes.id;
    const path = relationshipId ? relationships.get(relationshipId) : undefined;
    if (!path) continue;
    sheets.push({ name: decodeXmlEntities(attributes.name || `Sheet ${sheets.length + 1}`), path });
  }
  return sheets;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const values: string[] = [];
    for (const cellMatch of (rowMatch[1] || "").matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attributes = parseXmlAttributes(cellMatch[1] || "");
      const body = cellMatch[2] || "";
      const reference = attributes.r || "";
      const columnIndex = spreadsheetColumnIndex(reference);
      const valueMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
      const rawValue = valueMatch?.[1] || "";
      let value = "";

      if (attributes.t === "s") {
        value = sharedStrings[Number.parseInt(rawValue, 10)] || "";
      } else if (attributes.t === "inlineStr") {
        value = extractXmlText(body);
      } else if (attributes.t === "b") {
        value = rawValue === "1" ? "TRUE" : rawValue === "0" ? "FALSE" : rawValue;
      } else {
        value = decodeXmlEntities(rawValue);
      }

      const safeValue = value.replace(/[\t\r\n]+/g, " ").trim();
      const targetIndex = columnIndex >= 0 ? columnIndex : values.length;
      while (values.length < targetIndex) values.push("");
      values[targetIndex] = safeValue;
    }

    if (values.some(Boolean)) rows.push(values.join("\t").replace(/\t+$/g, ""));
  }
  return rows;
}

function extractXmlText(xml: string) {
  return decodeXmlEntities(
    Array.from(xml.matchAll(/<(?:[\w-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?t>/gi), (match) => match[1] || "").join("")
  );
}

function parseXmlAttributes(source: string) {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    attributes[match[1]] = decodeXmlEntities(match[3] || "");
  }
  return attributes;
}

function spreadsheetColumnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return -1;
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function normalizeZipPath(base: string, target: string) {
  const parts = `${base}/${target}`.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return normalized.join("/");
}

async function readZipTextFile(bytes: Uint8Array, targetName: string) {
  const entry = findCentralDirectoryEntry(bytes, targetName) || findLocalFileEntry(bytes, targetName);
  if (!entry) return "";

  const fileBytes = entry.compressionMethod === 0 ? entry.data : await decompress(entry.data, "deflate-raw");
  if (!fileBytes) return "";

  return textDecoder.decode(fileBytes);
}

function listZipEntryNames(bytes: Uint8Array) {
  const names: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset <= bytes.length - 46; offset += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    names.push(textDecoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength)));
    offset += 46 + fileNameLength + extraLength + commentLength - 1;
  }
  return names;
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

function extractPdfTextObjects(content: string, unicodeMap: Map<string, string> = new Map()) {
  const sections = Array.from(content.matchAll(/BT([\s\S]*?)ET/g), (match) => match[1]).filter(Boolean);
  const sources = sections.length ? sections : [content];
  const lines: string[] = [];

  for (const source of sources) {
    const strings = collectPdfStrings(source, unicodeMap);
    if (strings.length) lines.push(strings.join(" "));
  }

  return normalizeDocumentText(lines.join("\n"));
}

function collectPdfStrings(source: string, unicodeMap: Map<string, string>) {
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
        const decoded = decodePdfHexString(source.slice(index + 1, end), unicodeMap);
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

function decodePdfHexString(hex: string, unicodeMap: Map<string, string> = new Map()) {
  const clean = hex.replace(/\s+/g, "");
  if (!clean || clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return "";

  if (unicodeMap.size) {
    const keyLengths = Array.from(new Set(Array.from(unicodeMap.keys(), (key) => key.length))).sort((a, b) => b - a);
    let mapped = "";
    let offset = 0;
    let matched = false;
    while (offset < clean.length) {
      const length = keyLengths.find((candidate) => unicodeMap.has(clean.slice(offset, offset + candidate).toLocaleLowerCase()));
      if (!length) {
        mapped = "";
        break;
      }
      mapped += unicodeMap.get(clean.slice(offset, offset + length).toLocaleLowerCase()) || "";
      offset += length;
      matched = true;
    }
    if (matched && mapped) return mapped;
  }

  return decodePdfHexBytes(clean);
}

function decodePdfHexBytes(clean: string) {
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

function collectPdfUnicodeMap(sources: string[]) {
  const unicodeMap = new Map<string, string>();
  for (const source of sources) {
    for (const section of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/gi)) {
      for (const match of (section[1] || "").matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) {
        unicodeMap.set(match[1].toLocaleLowerCase(), decodePdfHexBytes(match[2]));
      }
    }

    for (const section of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/gi)) {
      const body = section[1] || "";
      for (const match of body.matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) {
        addPdfUnicodeRange(unicodeMap, match[1], match[2], match[3]);
      }
      for (const match of body.matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*\[([\s\S]*?)\]/gi)) {
        const start = Number.parseInt(match[1], 16);
        const end = Number.parseInt(match[2], 16);
        const sourceWidth = match[1].length;
        const destinations = Array.from((match[3] || "").matchAll(/<([0-9a-f]+)>/gi), (item) => item[1]);
        for (let code = start; code <= end && code - start < destinations.length; code += 1) {
          unicodeMap.set(code.toString(16).padStart(sourceWidth, "0"), decodePdfHexBytes(destinations[code - start]));
        }
      }
    }
  }
  return unicodeMap;
}

function addPdfUnicodeRange(unicodeMap: Map<string, string>, startHex: string, endHex: string, destinationHex: string) {
  const start = Number.parseInt(startHex, 16);
  const end = Number.parseInt(endHex, 16);
  const destination = Number.parseInt(destinationHex, 16);
  if (![start, end, destination].every(Number.isFinite) || end - start > 4096) return;
  for (let code = start; code <= end; code += 1) {
    const target = (destination + code - start).toString(16).padStart(destinationHex.length, "0");
    unicodeMap.set(code.toString(16).padStart(startHex.length, "0"), decodePdfHexBytes(target));
  }
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
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 16)));
}

function sourceLabel(kind: AttachmentExtractionKind) {
  if (kind === "pdf_text") return "PDF";
  if (kind === "docx_text") return "DOCX";
  if (kind === "xlsx_text") return "XLSX spreadsheet";
  if (kind === "pptx_text") return "PPTX presentation";
  return "document";
}
