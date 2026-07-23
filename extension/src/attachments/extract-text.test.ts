import { describe, expect, test } from "vitest";
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
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(name);
  const data = encoder.encode(content);
  const localHeaderLength = 30 + nameBytes.length;
  const centralHeaderLength = 46 + nameBytes.length;
  const output = new Uint8Array(localHeaderLength + data.length + centralHeaderLength);
  const view = new DataView(output.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(8, 0, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, nameBytes.length, true);
  output.set(nameBytes, 30);
  output.set(data, localHeaderLength);

  const centralOffset = localHeaderLength + data.length;
  view.setUint32(centralOffset, 0x02014b50, true);
  view.setUint16(centralOffset + 4, 20, true);
  view.setUint16(centralOffset + 6, 20, true);
  view.setUint16(centralOffset + 10, 0, true);
  view.setUint32(centralOffset + 20, data.length, true);
  view.setUint32(centralOffset + 24, data.length, true);
  view.setUint16(centralOffset + 28, nameBytes.length, true);
  view.setUint32(centralOffset + 42, 0, true);
  output.set(nameBytes, centralOffset + 46);

  return output;
}
