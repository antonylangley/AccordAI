import { describe, expect, test } from "vitest";
import { deflateRawSync } from "node:zlib";
import { extractGovernableAttachmentText } from "./extract-text";

describe("attachment text extraction", () => {
  test("extracts readable strings from a simple PDF stream", async () => {
    const pdf = new File(
      [
        `%PDF-1.4
1 0 obj
<< /Length 96 >>
stream
BT
/F1 12 Tf
(Jordan Example) Tj
(jordan.example@test.com) Tj
ET
endstream
endobj
%%EOF`
      ],
      "resume.pdf",
      { type: "application/pdf" }
    );

    const result = await extractGovernableAttachmentText(pdf);

    expect(result.status).toBe("extracted");
    if (result.status === "extracted") {
      expect(result.kind).toBe("pdf_text");
      expect(result.text).toContain("Jordan Example");
      expect(result.text).toContain("jordan.example@test.com");
    }
  });

  test("uses embedded PDF Unicode maps for encoded names", async () => {
    const pdf = new File(
      [
        `%PDF-1.4
1 0 obj
<< /Length 128 >>
stream
2 beginbfchar
<01> <004A>
<02> <006F>
endbfchar
endstream
endobj
2 0 obj
<< /Length 64 >>
stream
BT
/F1 12 Tf
<010202> Tj
ET
endstream
endobj
%%EOF`
      ],
      "encoded.pdf",
      { type: "application/pdf" }
    );

    const result = await extractGovernableAttachmentText(pdf);

    expect(result.status).toBe("extracted");
    if (result.status === "extracted") expect(result.text).toContain("Joo");
  });

  test("extracts paragraph text from a DOCX document XML part", async () => {
    const docx = new File(
      [
        storedZip(
          "word/document.xml",
          `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Jordan Example</w:t></w:r></w:p>
    <w:p><w:r><w:t>jordan.example@test.com</w:t></w:r></w:p>
  </w:body>
</w:document>`
        )
      ],
      "resume.docx",
      { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
    );

    const result = await extractGovernableAttachmentText(docx);

    expect(result.status).toBe("extracted");
    if (result.status === "extracted") {
      expect(result.kind).toBe("docx_text");
      expect(result.text).toContain("Jordan Example");
      expect(result.text).toContain("jordan.example@test.com");
    }
  });

  test("extracts shared and inline strings from an XLSX workbook", async () => {
    const xlsx = new File(
      [
        storedZipEntries({
          "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Customer risk" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
          "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
</Relationships>`,
          "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?>
<sst><si><t>Name</t></si><si><t>Email</t></si><si><t>Jordan Example</t></si><si><t>jordan.example@test.com</t></si></sst>`,
          "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
<worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
  <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" t="inlineStr"><is><t>High</t></is></c></row>
</sheetData></worksheet>`
        }, true)
      ],
      "customer-risk.xlsx",
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );

    const result = await extractGovernableAttachmentText(xlsx);

    expect(result.status).toBe("extracted");
    if (result.status === "extracted") {
      expect(result.kind).toBe("xlsx_text");
      expect(result.text).toContain("Sheet: Customer risk");
      expect(result.text).toContain("Name\tEmail");
      expect(result.text).toContain("Jordan Example\tjordan.example@test.com\tHigh");
    }
  });

  test("extracts slide and speaker-note text from a PPTX presentation", async () => {
    const pptx = new File(
      [
        storedZipEntries({
          "ppt/slides/slide1.xml": `<p:sld><a:p><a:r><a:t>Quarterly review for Jordan Example</a:t></a:r></a:p></p:sld>`,
          "ppt/notesSlides/notesSlide1.xml": `<p:notes><a:p><a:r><a:t>Email jordan.example@test.com after approval</a:t></a:r></a:p></p:notes>`
        }, true)
      ],
      "review.pptx",
      { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }
    );

    const result = await extractGovernableAttachmentText(pptx);

    expect(result.status).toBe("extracted");
    if (result.status === "extracted") {
      expect(result.kind).toBe("pptx_text");
      expect(result.text).toContain("Slide 1: Quarterly review for Jordan Example");
      expect(result.text).toContain("Notes 1: Email jordan.example@test.com after approval");
    }
  });

  test("fails closed when a PDF has no readable text", async () => {
    const pdf = new File(["%PDF-1.4\n%%EOF"], "scan.pdf", { type: "application/pdf" });
    const result = await extractGovernableAttachmentText(pdf);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toContain("could not extract readable text");
    }
  });
});

function storedZip(name: string, content: string) {
  return storedZipEntries({ [name]: content });
}

function storedZipEntries(entries: Record<string, string>, compress = false) {
  const encoder = new TextEncoder();
  const encoded = Object.entries(entries).map(([name, content]) => ({
    nameBytes: encoder.encode(name),
    data: compress ? new Uint8Array(deflateRawSync(encoder.encode(content))) : encoder.encode(content)
  }));
  const localSize = encoded.reduce((size, entry) => size + 30 + entry.nameBytes.length + entry.data.length, 0);
  const centralSize = encoded.reduce((size, entry) => size + 46 + entry.nameBytes.length, 0);
  const output = new Uint8Array(localSize + centralSize);
  const view = new DataView(output.buffer);
  const localOffsets: number[] = [];
  let localOffset = 0;
  for (const entry of encoded) {
    localOffsets.push(localOffset);
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint16(localOffset + 4, 20, true);
    view.setUint16(localOffset + 8, compress ? 8 : 0, true);
    view.setUint32(localOffset + 18, entry.data.length, true);
    view.setUint32(localOffset + 22, entry.data.length, true);
    view.setUint16(localOffset + 26, entry.nameBytes.length, true);
    output.set(entry.nameBytes, localOffset + 30);
    output.set(entry.data, localOffset + 30 + entry.nameBytes.length);
    localOffset += 30 + entry.nameBytes.length + entry.data.length;
  }

  let centralOffset = localSize;
  encoded.forEach((entry, index) => {
    view.setUint32(centralOffset, 0x02014b50, true);
    view.setUint16(centralOffset + 4, 20, true);
    view.setUint16(centralOffset + 6, 20, true);
    view.setUint16(centralOffset + 10, compress ? 8 : 0, true);
    view.setUint32(centralOffset + 20, entry.data.length, true);
    view.setUint32(centralOffset + 24, entry.data.length, true);
    view.setUint16(centralOffset + 28, entry.nameBytes.length, true);
    view.setUint32(centralOffset + 42, localOffsets[index], true);
    output.set(entry.nameBytes, centralOffset + 46);
    centralOffset += 46 + entry.nameBytes.length;
  });

  return output;
}
