import { describe, expect, test } from "vitest";
import { extractPolicyDocumentText } from "./document-text";
import { inferPolicyIdentityFromDocument } from "./policy-metadata";
import { canPublishPolicyRuleControl } from "./enforceability";
import { inferPolicyRulesFromText } from "./rule-inference";

describe("policy document metadata extraction", () => {
  test("uses DOCX title style and explicit Purpose section", async () => {
    const extracted = await extractPolicyDocumentText({
      buffer: docxBuffer([
        paragraph("Northstar Clinical AI Policy", "Title"),
        paragraph("Purpose", "Heading1"),
        paragraph("This policy defines how Northstar employees may use generative AI with clinical information."),
        paragraph("Requirements", "Heading1"),
        paragraph("Employees must never submit API keys or passwords to external AI services.")
      ]),
      fileName: "northstar-clinical-ai-policy.docx"
    });
    const policy = inferPolicyIdentityFromDocument(extracted, "northstar-clinical-ai-policy.docx");

    expect(policy.title.value).toBe("Northstar Clinical AI Policy");
    expect(policy.title.extractionMethod).toBe("docx_title_style");
    expect(policy.description.value).toContain("Northstar employees may use generative AI");
    expect(policy.description.extractionMethod).toBe("explicit_purpose_section");
    expect(policy.sections.map((section) => section.heading)).toContain("Purpose");
  });

  test("finds a DOCX heading title when no Title style exists and preserves organization above it", async () => {
    const extracted = await extractPolicyDocumentText({
      buffer: docxBuffer([
        paragraph("Northstar Health"),
        paragraph("Generative AI Acceptable Use Policy", "Heading1"),
        paragraph("Purpose", "Heading2"),
        paragraph("This policy governs workforce use of approved and unapproved generative AI services.")
      ]),
      fileName: "acceptable-use.docx"
    });
    const policy = inferPolicyIdentityFromDocument(extracted, "acceptable-use.docx");

    expect(policy.title.value).toBe("Generative AI Acceptable Use Policy");
    expect(policy.title.extractionMethod).toBe("docx_heading");
    expect(policy.organizationName?.value).toBe("Northstar Health");
  });

  test("extracts policy identity from a DOCX metadata table", async () => {
    const extracted = await extractPolicyDocumentText({
      buffer: docxBuffer([
        table([
          ["Policy Title", "Enterprise Generative AI Policy"],
          ["Organization", "Northstar Health"],
          ["Policy Owner", "Compliance"],
          ["Effective Date", "2026-01-15"],
          ["Version", "2.1"],
          ["Scope", "All workforce members and contractors"]
        ]),
        paragraph("Purpose", "Heading1"),
        paragraph("This policy establishes requirements for responsible AI use.")
      ]),
      fileName: "enterprise-ai-policy.docx"
    });
    const policy = inferPolicyIdentityFromDocument(extracted, "enterprise-ai-policy.docx");

    expect(policy.title.value).toBe("Enterprise Generative AI Policy");
    expect(policy.title.extractionMethod).toBe("docx_table");
    expect(policy.organizationName?.value).toBe("Northstar Health");
    expect(policy.owner?.value).toBe("Compliance");
    expect(policy.effectiveDate?.value).toBe("2026-01-15");
    expect(policy.version?.value).toBe("2.1");
    expect(policy.scope?.value).toBe("All workforce members and contractors");
  });

  test("uses DOCX document properties when they contain the policy title", async () => {
    const extracted = await extractPolicyDocumentText({
      buffer: docxBuffer([paragraph("Purpose", "Heading1"), paragraph("This policy governs use of generative AI.")], {
        title: "Responsible AI Governance Policy",
        description: "Corporate policy for responsible AI governance"
      }),
      fileName: "responsible-ai.docx"
    });
    const policy = inferPolicyIdentityFromDocument(extracted, "responsible-ai.docx");

    expect(policy.title.value).toBe("Responsible AI Governance Policy");
    expect(policy.title.extractionMethod).toBe("document_property");
  });

  test("does not choose a larger organization line as a PDF policy title", async () => {
    const extracted = await extractPolicyDocumentText({
      buffer: pdfBuffer([
        { text: "Northstar Health", fontSize: 28 },
        { text: "Generative AI Acceptable Use Policy", fontSize: 18 },
        { text: "Purpose", fontSize: 16 },
        { text: "This policy governs how employees use approved AI systems.", fontSize: 11 }
      ]),
      fileName: "northstar-policy.pdf"
    });
    const policy = inferPolicyIdentityFromDocument(extracted, "northstar-policy.pdf");

    expect(policy.title.value).toBe("Generative AI Acceptable Use Policy");
    expect(policy.title.extractionMethod).toBe("pdf_heading");
    expect(policy.organizationName?.value).toBe("Northstar Health");
  });

  test("ignores repeated PDF header and footer text when selecting title and sections", async () => {
    const extracted = await extractPolicyDocumentText({
      buffer: pdfBuffer([
        { text: "CONFIDENTIAL", fontSize: 10 },
        { text: "Generative AI Governance Policy", fontSize: 18 },
        { text: "Purpose", fontSize: 16 },
        { text: "This policy governs use of AI across the company.", fontSize: 11 },
        { text: "CONFIDENTIAL", fontSize: 10 },
        { text: "Page 1", fontSize: 10 },
        { text: "CONFIDENTIAL", fontSize: 10 },
        { text: "Requirements", fontSize: 16 },
        { text: "Employees must not submit PHI to public AI services.", fontSize: 11 },
        { text: "CONFIDENTIAL", fontSize: 10 },
        { text: "Page 2", fontSize: 10 }
      ]),
      fileName: "ai-governance.pdf"
    });
    const policy = inferPolicyIdentityFromDocument(extracted, "ai-governance.pdf");

    expect(policy.title.value).toBe("Generative AI Governance Policy");
    expect(policy.sections.map((section) => section.heading)).not.toContain("CONFIDENTIAL");
  });

  test("marks descriptions as derived when no explicit purpose or overview exists", async () => {
    const extracted = await extractPolicyDocumentText({
      buffer: Buffer.from(
        [
          "Generative AI Acceptable Use Policy",
          "",
          "This document sets boundaries for employee use of AI systems with company information.",
          "Employees must not use personal AI accounts for company work."
        ].join("\n"),
        "utf8"
      ),
      fileName: "acceptable-use.md",
      contentType: "text/markdown"
    });
    const policy = inferPolicyIdentityFromDocument(extracted, "acceptable-use.md");

    expect(policy.description.value).toContain("sets boundaries");
    expect(policy.description.derived).toBe(true);
    expect(policy.description.confidence).toBeLessThan(0.7);
  });

  test("flags scanned PDFs for OCR fallback instead of semantic interpretation", async () => {
    const extracted = await extractPolicyDocumentText({
      buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF", "latin1"),
      fileName: "scanned-healthcare-ai-policy.pdf",
      contentType: "application/pdf"
    });
    const policy = inferPolicyIdentityFromDocument(extracted, "scanned-healthcare-ai-policy.pdf");

    expect(extracted.ocrFallbackRequired).toBe(true);
    expect(extracted.extractionKind).toBe("ocr_required");
    expect(policy.ocrFallbackRequired).toBe(true);
    expect(policy.title.extractionMethod).toBe("filename_fallback");
    expect(policy.metadataWarnings.join(" ")).toContain("OCR is required");
  });
});

describe("policy import pipeline", () => {
  test("keeps policy identity, requirement traceability, enforceability, recommendations, and publishable controls separate", async () => {
    const extracted = await extractPolicyDocumentText({
      buffer: docxBuffer([
        table([
          ["Policy Title", "Northstar Healthcare AI Policy"],
          ["Organization", "Northstar Health"],
          ["Policy Owner", "Clinical Compliance"],
          ["Effective Date", "2026-02-01"],
          ["Version", "3.0"]
        ]),
        paragraph("Purpose", "Heading1"),
        paragraph("This policy governs use of AI with patient information and company intellectual property."),
        paragraph("Requirements", "Heading1"),
        paragraph("Employees may only process patient information using AI systems specifically authorized by Northstar for clinical or healthcare data."),
        paragraph("Employees must review AI-generated material before sending it to patients, customers, business partners, regulators, or the public."),
        paragraph("Employees must never submit API keys or passwords to external AI services."),
        paragraph(
          "Employees must not knowingly submit confidential source code, proprietary algorithms, unpublished research, trade secrets, or other protected intellectual property to an external AI service unless that service has been approved for such use."
        )
      ]),
      fileName: "northstar-healthcare-ai-policy.docx"
    });
    const policy = inferPolicyIdentityFromDocument(extracted, "northstar-healthcare-ai-policy.docx");
    const inferred = inferPolicyRulesFromText(extracted.text, "northstar-healthcare-ai-policy.docx", policy);
    const patientRule = inferred.rules.find((rule) => rule.sourceText.includes("patient information"));
    const outputRule = inferred.rules.find((rule) => rule.sourceText.includes("review AI-generated material"));
    const secretRule = inferred.rules.find((rule) => rule.sourceText.includes("API keys or passwords"));
    const ipRule = inferred.rules.find((rule) => rule.sourceText.includes("confidential source code"));

    expect(policy.title.value).toBe("Northstar Healthcare AI Policy");
    expect(policy.organizationName?.value).toBe("Northstar Health");
    expect(patientRule?.policyId).toBe(policy.id);
    expect(patientRule?.requirementId).toMatch(/^requirement_/);
    expect(patientRule?.destinationAuthorizations[0]?.condition).toContain("clinical or healthcare data");
    expect(outputRule?.enforceability).toBe("not_enforceable");
    expect(outputRule?.recommendedAction).toBeNull();
    expect(secretRule?.controlType).toBe("security_secret");
    expect(ipRule?.controlType).toBe("intellectual_property");

    const adminEditedPatientRule = {
      ...patientRule!,
      recommendedAction: patientRule!.recommendedAction,
      action: "warn" as const,
      recommendedSeverity: patientRule!.recommendedSeverity,
      severity: "medium" as const
    };

    expect(adminEditedPatientRule.recommendedAction).toBe("block");
    expect(adminEditedPatientRule.action).toBe("warn");
    expect(adminEditedPatientRule.recommendedSeverity).not.toBe(adminEditedPatientRule.severity);

    const publishable = inferred.rules.filter(canPublishPolicyRuleControl);
    expect(publishable).toContain(patientRule);
    expect(publishable).toContain(secretRule);
    expect(publishable).toContain(ipRule);
    expect(publishable).not.toContain(outputRule);
    expect(publishable.every((rule) => rule.supportingExcerpt && rule.sourceText && rule.confidence > 0)).toBe(true);
  });
});

function paragraph(text: string, style?: string) {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${escapeXml(style)}"/></w:pPr>` : "";
  return `<w:p>${styleXml}<w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function table(rows: string[][]) {
  return `<w:tbl>${rows
    .map(
      (row) =>
        `<w:tr>${row
          .map((cell) => `<w:tc><w:p><w:r><w:t>${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`)
          .join("")}</w:tr>`
    )
    .join("")}</w:tbl>`;
}

function docxBuffer(bodyFragments: string[], properties: { title?: string; description?: string } = {}) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyFragments.join("")}</w:body></w:document>`;
  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">${properties.title ? `<dc:title>${escapeXml(properties.title)}</dc:title>` : ""}${properties.description ? `<dc:description>${escapeXml(properties.description)}</dc:description>` : ""}</cp:coreProperties>`;

  return zipBuffer([
    ["word/document.xml", documentXml],
    ["docProps/core.xml", coreXml]
  ]);
}

function zipBuffer(entries: Array<[string, string]>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBuffer = Buffer.from(name, "utf8");
    const contentBuffer = Buffer.from(content, "utf8");
    const local = Buffer.alloc(30 + nameBuffer.length + contentBuffer.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(contentBuffer.length, 18);
    local.writeUInt32LE(contentBuffer.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuffer.copy(local, 30);
    contentBuffer.copy(local, 30 + nameBuffer.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + nameBuffer.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(contentBuffer.length, 20);
    central.writeUInt32LE(contentBuffer.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuffer.copy(central, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function pdfBuffer(lines: Array<{ text: string; fontSize: number }>) {
  const stream = `BT\n${lines.map((line, index) => `/F1 ${line.fontSize} Tf 50 ${760 - index * 28} Td (${escapePdf(line.text)}) Tj`).join("\n")}\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
  ];
  return Buffer.from(`%PDF-1.4\n${objects.join("\n")}\n%%EOF`, "latin1");
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapePdf(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
