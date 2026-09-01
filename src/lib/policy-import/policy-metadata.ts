import { createHash } from "node:crypto";
import type { ExtractedPolicyDocument, PolicyDocumentTextBlock } from "./document-text";
import type {
  ImportedPolicyIdentity,
  ImportedPolicyMetadataExtractionMethod,
  ImportedPolicyMetadataField,
  ImportedPolicySection
} from "./types";

type MetadataCandidate = ImportedPolicyMetadataField & {
  blockIndex?: number;
};

const titleLabels = ["policy title", "policy name", "document title", "title"];
const organizationLabels = ["organization", "company", "entity", "owner organization", "policy owner organization"];
const ownerLabels = ["owner", "policy owner", "business owner", "document owner", "responsible owner"];
const effectiveDateLabels = ["effective date", "date effective", "effective", "approval date", "approved date"];
const versionLabels = ["version", "policy version", "document version", "revision"];
const scopeLabels = ["scope", "applies to", "applicability"];

const purposeHeadings = new Set(["purpose", "policy purpose", "overview", "policy statement", "introduction"]);

export function inferPolicyIdentityFromDocument(extracted: ExtractedPolicyDocument, fileName: string): ImportedPolicyIdentity {
  const blocks = meaningfulBlocks(extracted);
  const title = chooseTitle(extracted, fileName, blocks);
  const organizationName = chooseOrganization(extracted, blocks, title);
  const sections = extractPolicySections(blocks, title.value);
  const description = chooseDescription(extracted, blocks, sections, title);
  const owner = chooseLabeledField(blocks, ownerLabels, extracted.fileType, 0.86);
  const effectiveDate = chooseLabeledField(blocks, effectiveDateLabels, extracted.fileType, 0.86);
  const version = chooseLabeledField(blocks, versionLabels, extracted.fileType, 0.84);
  const scope = chooseScope(extracted, blocks, sections);
  const warnings = [...extracted.warnings];

  if (extracted.ocrFallbackRequired) {
    warnings.push("Policy identity was limited to filename/native metadata because OCR is required before policy text can be interpreted.");
  }
  if (title.extractionMethod === "filename_fallback") {
    warnings.push("Policy title was inferred from the filename. Please confirm it before saving drafts.");
  }
  if (description.derived) {
    warnings.push("Policy description was derived from opening text because no explicit purpose or overview section was found.");
  }

  const confidenceValues = [
    title.confidence,
    description.confidence,
    organizationName?.confidence,
    owner?.confidence,
    effectiveDate?.confidence,
    version?.confidence,
    scope?.confidence
  ].filter((value): value is number => typeof value === "number");

  return {
    id: policyIdFor(fileName, title.value, organizationName?.value, version?.value),
    title,
    description,
    organizationName,
    owner,
    effectiveDate,
    version,
    scope,
    sourceFileName: fileName,
    sourceFileType: extracted.fileType,
    metadataExtractionConfidence: roundConfidence(average(confidenceValues)),
    metadataWarnings: unique(warnings),
    sections,
    ocrFallbackRequired: extracted.ocrFallbackRequired
  };
}

export function extractPolicySections(blocks: PolicyDocumentTextBlock[], policyTitle?: string): ImportedPolicySection[] {
  const sections: ImportedPolicySection[] = [];
  let current: {
    heading: string;
    level: number;
    sourcePage?: number;
    sourceText?: string;
    parts: string[];
  } | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.parts.join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= 20) {
      sections.push({
        id: `section_${hashText(`${current.heading}:${text}`).slice(0, 10)}`,
        heading: current.heading,
        level: current.level,
        text: clampText(text, 2500),
        sourcePage: current.sourcePage,
        sourceText: current.sourceText
      });
    }
    current = null;
  };

  for (const block of blocks) {
    const text = block.text.trim();
    if (!text || isMetadataLine(text)) continue;
    const heading = cleanHeading(text);
    const isHeading = block.kind === "heading" || block.kind === "title";
    const isPolicyTitle = policyTitle && normalizeLabel(heading) === normalizeLabel(policyTitle);

    if (isHeading && !isPolicyTitle && heading.length <= 120) {
      flush();
      current = {
        heading,
        level: block.level || 1,
        sourcePage: block.page,
        sourceText: text,
        parts: []
      };
      continue;
    }

    if (!current) {
      current = {
        heading: "Opening",
        level: 1,
        sourcePage: block.page,
        sourceText: text,
        parts: []
      };
    }
    current.parts.push(text);
  }

  flush();
  return sections.slice(0, 40);
}

function chooseTitle(extracted: ExtractedPolicyDocument, fileName: string, blocks: PolicyDocumentTextBlock[]): ImportedPolicyMetadataField {
  const titleBlock = blocks.find((block) => block.kind === "title" && looksLikePolicyTitle(block.text));
  if (titleBlock) return field(titleBlock.text, 0.94, "docx_title_style", titleBlock);

  const labeled = chooseLabeledField(blocks, titleLabels, extracted.fileType, 0.9);
  if (labeled && looksLikePolicyTitle(labeled.value)) return labeled;

  const propertyTitle = extracted.properties.title;
  if (propertyTitle && looksLikePolicyTitle(propertyTitle)) {
    return field(propertyTitle, 0.86, "document_property", undefined, "DOCX document properties");
  }

  const heading = blocks.find((block) => (block.kind === "heading" || block.kind === "pdf_text") && looksLikePolicyTitle(block.text));
  if (heading) return field(heading.text, heading.fontSize ? 0.84 : 0.8, extracted.fileType === "pdf" ? "pdf_heading" : "docx_heading", heading);

  const openingLine = textLines(extracted.text).slice(0, 16).find(looksLikePolicyTitle);
  if (openingLine) return field(openingLine, 0.68, extracted.fileType === "pdf" ? "pdf_heading" : "opening_text");

  return field(titleFromFileName(fileName), 0.42, "filename_fallback", undefined, fileName, undefined, true);
}

function chooseOrganization(
  extracted: ExtractedPolicyDocument,
  blocks: PolicyDocumentTextBlock[],
  title: ImportedPolicyMetadataField
): ImportedPolicyMetadataField | undefined {
  const labeled = chooseLabeledField(blocks, organizationLabels, extracted.fileType, 0.86);
  if (labeled) return labeled;

  const titleIndex = blocks.findIndex((block) => normalizeLabel(block.text) === normalizeLabel(title.sourceText || title.value));
  const preceding = titleIndex > 0 ? blocks.slice(Math.max(0, titleIndex - 4), titleIndex).reverse() : blocks.slice(0, 5);
  const organizationBlock = preceding.find((block) => looksLikeOrganizationName(block.text));
  if (organizationBlock) return field(organizationBlock.text, 0.72, extracted.fileType === "pdf" ? "pdf_layout" : "opening_text", organizationBlock);

  return undefined;
}

function chooseDescription(
  extracted: ExtractedPolicyDocument,
  blocks: PolicyDocumentTextBlock[],
  sections: ImportedPolicySection[],
  title: ImportedPolicyMetadataField
): ImportedPolicyMetadataField {
  const explicit = sections.find((section) => purposeHeadings.has(normalizeLabel(section.heading)));
  if (explicit) {
    return field(clampText(explicit.text, 700), 0.88, "explicit_purpose_section", undefined, explicit.sourceText || explicit.text, explicit.sourcePage);
  }

  const overview = sections.find((section) => /purpose|overview|policy statement|introduction/i.test(section.heading));
  if (overview) {
    return field(clampText(overview.text, 700), 0.82, "explicit_purpose_section", undefined, overview.sourceText || overview.text, overview.sourcePage);
  }

  const opening = blocks
    .filter((block) => block.source === "body" && block.kind !== "table_row")
    .map((block) => block.text)
    .filter((text) => text !== title.value && !looksLikePolicyTitle(text) && !looksLikeOrganizationName(text) && !isMetadataLine(text))
    .filter((text) => text.length >= 35)
    .slice(0, 3)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (opening) return field(clampText(opening, 700), 0.58, "opening_text", undefined, opening, undefined, true);
  return field(`Imported policy document for ${title.value}.`, 0.35, "derived", undefined, title.value, undefined, true);
}

function chooseScope(
  extracted: ExtractedPolicyDocument,
  blocks: PolicyDocumentTextBlock[],
  sections: ImportedPolicySection[]
): ImportedPolicyMetadataField | undefined {
  const labeled = chooseLabeledField(blocks, scopeLabels, extracted.fileType, 0.86);
  if (labeled) return labeled;

  const scope = sections.find((section) => normalizeLabel(section.heading) === "scope");
  if (!scope) return undefined;
  return field(clampText(scope.text, 500), 0.82, "explicit_purpose_section", undefined, scope.sourceText || scope.text, scope.sourcePage);
}

function chooseLabeledField(
  blocks: PolicyDocumentTextBlock[],
  labels: string[],
  fileType: ExtractedPolicyDocument["fileType"],
  baseConfidence: number
): MetadataCandidate | undefined {
  const normalizedLabels = labels.map(normalizeLabel);

  for (const [index, block] of blocks.entries()) {
    if (block.kind === "table_row" && block.cells?.length) {
      const labelIndex = block.cells.findIndex((cell) => normalizedLabels.includes(normalizeLabel(trimTrailingLabel(cell))));
      if (labelIndex >= 0 && block.cells[labelIndex + 1]) {
        return field(block.cells[labelIndex + 1], baseConfidence + 0.04, "docx_table", block, block.text, block.page, false, index);
      }
    }

    const inline = splitLabeledValue(block.text, normalizedLabels);
    if (inline) {
      return field(
        inline,
        baseConfidence,
        fileType === "docx" ? "docx_labeled_field" : "opening_text",
        block,
        block.text,
        block.page,
        false,
        index
      );
    }
  }

  return undefined;
}

function meaningfulBlocks(extracted: ExtractedPolicyDocument) {
  const sourceBlocks = extracted.blocks.length ? extracted.blocks : textBlocksFromExtractedText(extracted.text);
  const counts = new Map<string, number>();
  for (const block of sourceBlocks) {
    const key = normalizeRepeatedText(block.text);
    if (key && block.text.length <= 100) counts.set(key, (counts.get(key) || 0) + 1);
  }

  return sourceBlocks.filter((block) => {
    const key = normalizeRepeatedText(block.text);
    if (!block.text.trim()) return false;
    if (block.source === "header" || block.source === "footer") return false;
    if (key && (counts.get(key) || 0) > 1 && looksLikeHeaderFooter(block.text)) return false;
    return true;
  });
}

function textBlocksFromExtractedText(text: string): PolicyDocumentTextBlock[] {
  return textLines(text).map((line) => ({
    text: line,
    kind: looksLikePlainHeading(line) ? "heading" : "paragraph",
    source: "body",
    level: looksLikePlainHeading(line) ? 1 : 0
  }));
}

function field(
  value: string,
  confidence: number,
  extractionMethod: ImportedPolicyMetadataExtractionMethod,
  block?: PolicyDocumentTextBlock,
  sourceText = block?.text,
  sourcePage = block?.page,
  derived = false,
  blockIndex?: number
): MetadataCandidate {
  return {
    value: value.replace(/\s+/g, " ").trim(),
    confidence: roundConfidence(confidence),
    sourceText,
    sourceSection: block?.style || block?.kind,
    sourcePage,
    extractionMethod,
    derived,
    blockIndex
  };
}

function splitLabeledValue(text: string, labels: string[]) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const match = trimmed.match(/^([A-Za-z][A-Za-z /_-]{1,50})\s*[:\-]\s*(.+)$/);
  if (!match) return "";
  if (!labels.includes(normalizeLabel(match[1]))) return "";
  return match[2].trim();
}

function isMetadataLine(text: string) {
  return /^(policy title|policy name|document title|title|organization|company|owner|policy owner|business owner|effective date|date effective|version|policy version|document version|revision|scope)\s*[:\-]/i.test(
    text.trim()
  );
}

function looksLikePolicyTitle(value: string) {
  const clean = trimTrailingLabel(value).replace(/\s+/g, " ").trim();
  if (clean.length < 6 || clean.length > 150) return false;
  if (isMetadataLine(clean)) return false;
  if (/^(confidential|internal use only|draft|page \d+|\d+)$/.test(clean.toLocaleLowerCase())) return false;
  if (/\b(purpose|scope|background|definitions|responsibilities|procedure|requirements?)\b$/i.test(clean) && clean.split(/\s+/).length <= 3) {
    return false;
  }
  return /\b(policy|standard|guideline|governance|acceptable use|responsible ai|ai usage|artificial intelligence|generative ai|genai)\b/i.test(clean);
}

function looksLikeOrganizationName(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length < 3 || clean.length > 100) return false;
  if (clean.split(/\s+/).length > 8 || /[.!?]$/.test(clean)) return false;
  if (looksLikePolicyTitle(clean) || isMetadataLine(clean)) return false;
  if (/^(confidential|internal use only|draft|page \d+|\d+)$/.test(clean.toLocaleLowerCase())) return false;
  return /\b(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.|health|healthcare|clinic|hospital|bank|financial|systems|technologies|labs|group|partners|northstar|accord)\b/i.test(
    clean
  );
}

function looksLikeHeaderFooter(text: string) {
  const clean = text.toLocaleLowerCase().trim();
  return /^(confidential|internal use only|draft|page \d+|\d+)$/.test(clean) || clean.length <= 24;
}

function looksLikePlainHeading(value: string) {
  const clean = trimTrailingLabel(value);
  if (clean.length < 3 || clean.length > 120) return false;
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(value)) return true;
  if (/^[A-Z][A-Z0-9 /&,-]{5,}$/.test(clean)) return true;
  return /^[A-Z][a-z]+(\s+[A-Z][a-z]+){0,7}:?$/.test(clean) && !/[.!?]$/.test(clean);
}

function cleanHeading(value: string) {
  return trimTrailingLabel(value).replace(/^(\d+(\.\d+)*[.)]?|[A-Za-z][.)]|[-*])\s+/, "").trim();
}

function trimTrailingLabel(value: string) {
  return value.replace(/:$/, "").trim();
}

function normalizeLabel(value: string) {
  return trimTrailingLabel(value).toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeRepeatedText(value: string) {
  return value.toLocaleLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

function textLines(value: string) {
  return value
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function titleFromFileName(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return stem ? titleCase(stem) : "Imported AI Usage Policy";
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase());
}

function policyIdFor(fileName: string, title: string, organization?: string, version?: string) {
  return `policy_${hashText([fileName, title, organization || "", version || ""].join(":")).slice(0, 12)}`;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function average(values: number[]) {
  if (!values.length) return 0.5;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundConfidence(value: number) {
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
}

function clampText(value: string, maxLength: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}...` : clean;
}
