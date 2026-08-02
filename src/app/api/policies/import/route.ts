import { NextResponse } from "next/server";
import { extractPolicyDocumentText } from "@/lib/policy-import/document-text";
import { inferPolicyRulesFromText } from "@/lib/policy-import/rule-inference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxUploadBytes = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a PDF, DOCX, DOC, TXT, or Markdown policy document." }, { status: 400 });
    }

    if (file.size > maxUploadBytes) {
      return NextResponse.json({ error: "Policy document is too large. Keep imports under 8 MB for this prototype." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractPolicyDocumentText({
      buffer,
      fileName: file.name,
      contentType: file.type
    });

    if (extracted.text.length < 80) {
      return NextResponse.json(
        {
          error: "Accord could not extract enough text from this document.",
          warnings: extracted.warnings
        },
        { status: 422 }
      );
    }

    const inferred = inferPolicyRulesFromText(extracted.text, file.name);

    return NextResponse.json({
      fileName: file.name,
      fileType: extracted.fileType,
      extractedCharacters: extracted.text.length,
      rules: inferred.rules,
      warnings: [...extracted.warnings, ...inferred.warnings]
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not import the policy document."
      },
      { status: 500 }
    );
  }
}
