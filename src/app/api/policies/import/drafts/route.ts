import { NextResponse } from "next/server";
import { createPolicyRulesFromInputs, type PolicyRuleDraftInput } from "@/lib/db/accord-store";
import type { ImportedPolicyIdentity, ImportedPolicyMetadataExtractionMethod } from "@/lib/policy-import/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { companySlug?: unknown; policy?: unknown; rules?: unknown };
    const companySlug = typeof body.companySlug === "string" && body.companySlug.trim() ? body.companySlug.trim() : "test-company";
    const policy = normalizePolicy(body.policy);
    const rules = Array.isArray(body.rules)
      ? body.rules.map(normalizeRule).filter((rule): rule is PolicyRuleDraftInput => Boolean(rule))
      : [];

    if (!rules.length) {
      return NextResponse.json({ error: "Choose at least one imported rule to save." }, { status: 400 });
    }

    const created = await createPolicyRulesFromInputs(rules, companySlug, policy);

    return NextResponse.json({
      created,
      count: created.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not save imported rules."
      },
      { status: 500 }
    );
  }
}

function normalizeRule(value: unknown): PolicyRuleDraftInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  return {
    policyDocumentId: stringValue(record.policyDocumentId),
    policyId: stringValue(record.policyId),
    requirementId: stringValue(record.requirementId),
    name: stringValue(record.name),
    ruleKey: stringValue(record.ruleKey),
    sourceText: stringValue(record.sourceText),
    sourcePolicyName: stringValue(record.sourcePolicyName),
    sourceSection: stringValue(record.sourceSection),
    sourcePage: numberValue(record.sourcePage),
    supportingExcerpt: stringValue(record.supportingExcerpt),
    requirementSummary: stringValue(record.requirementSummary),
    controlType: stringValue(record.controlType) as PolicyRuleDraftInput["controlType"],
    requirementDirection: stringValue(record.requirementDirection) as PolicyRuleDraftInput["requirementDirection"],
    enforceability: stringValue(record.enforceability) as PolicyRuleDraftInput["enforceability"],
    dataCategories: Array.isArray(record.dataCategories) ? record.dataCategories.filter((item): item is string => typeof item === "string") : stringValue(record.dataCategories),
    destinationTypes: Array.isArray(record.destinationTypes)
      ? record.destinationTypes.filter((item): item is NonNullable<PolicyRuleDraftInput["destinationType"]> => typeof item === "string")
      : stringValue(record.destinationTypes),
    userScope: stringValue(record.userScope),
    departmentScope: stringValue(record.departmentScope),
    aiProvider: stringValue(record.aiProvider),
    destinationType: stringValue(record.destinationType) as PolicyRuleDraftInput["destinationType"],
    recommendedAction:
      record.recommendedAction === null ? null : (stringValue(record.recommendedAction) as PolicyRuleDraftInput["recommendedAction"]),
    action: stringValue(record.action) as PolicyRuleDraftInput["action"],
    fallbackAction: stringValue(record.fallbackAction) as PolicyRuleDraftInput["fallbackAction"],
    recommendedSeverity: stringValue(record.recommendedSeverity) as PolicyRuleDraftInput["recommendedSeverity"],
    severity: stringValue(record.severity) as PolicyRuleDraftInput["severity"],
    conditionDescription: stringValue(record.conditionDescription),
    employeeExplanation: stringValue(record.employeeExplanation),
    reasoning: stringValue(record.reasoning),
    destinationAuthorizations: destinationAuthorizationsValue(record.destinationAuthorizations),
    confidence: numberValue(record.confidence),
    metadata: metadataValue(record.metadata),
    effectiveDate: stringValue(record.effectiveDate)
  };
}

function normalizePolicy(value: unknown): ImportedPolicyIdentity | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (!record.title || typeof record.title !== "object") return undefined;
  const sourceFileType = stringValue(record.sourceFileType);
  const title = record.title as Record<string, unknown>;
  const description = typeof record.description === "object" && record.description ? (record.description as Record<string, unknown>) : {};

  return {
    id: stringValue(record.id),
    title: metadataFieldValue(title, "Imported AI policy"),
    description: metadataFieldValue(description, ""),
    organizationName: optionalMetadataField(record.organizationName),
    owner: optionalMetadataField(record.owner),
    effectiveDate: optionalMetadataField(record.effectiveDate),
    version: optionalMetadataField(record.version),
    scope: optionalMetadataField(record.scope),
    sourceFileName: stringValue(record.sourceFileName),
    sourceFileType: sourceFileType === "pdf" || sourceFileType === "docx" || sourceFileType === "doc" || sourceFileType === "text" ? sourceFileType : "text",
    metadataExtractionConfidence: numberValue(record.metadataExtractionConfidence) ?? 0.5,
    metadataWarnings: stringListValue(record.metadataWarnings),
    sections: Array.isArray(record.sections)
      ? record.sections
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
          .map((item) => ({
            id: stringValue(item.id),
            heading: stringValue(item.heading),
            level: numberValue(item.level) ?? 1,
            text: stringValue(item.text),
            sourcePage: numberValue(item.sourcePage),
            sourceText: stringValue(item.sourceText)
          }))
          .filter((section) => section.heading && section.text)
      : [],
    ocrFallbackRequired: record.ocrFallbackRequired === true
  };
}

function metadataFieldValue(record: Record<string, unknown>, fallback: string): ImportedPolicyIdentity["title"] {
  const extractionMethod = stringValue(record.extractionMethod) || "admin_override";
  return {
    value: stringValue(record.value) || fallback,
    confidence: numberValue(record.confidence) ?? 0.5,
    sourceText: stringValue(record.sourceText),
    sourceSection: stringValue(record.sourceSection),
    sourcePage: numberValue(record.sourcePage),
    extractionMethod: extractionMethod as ImportedPolicyMetadataExtractionMethod,
    derived: record.derived === true
  };
}

function optionalMetadataField(value: unknown): ImportedPolicyIdentity["title"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const field = metadataFieldValue(value as Record<string, unknown>, "");
  return field.value ? field : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringListValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

function metadataValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, item]) => ["string", "number", "boolean"].includes(typeof item) || item == null)
  );
}

function destinationAuthorizationsValue(value: unknown): PolicyRuleDraftInput["destinationAuthorizations"] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      provider: stringValue(item.provider) || "any",
      destinationType: stringValue(item.destinationType) as NonNullable<PolicyRuleDraftInput["destinationType"]>,
      dataCategories: stringListValue(item.dataCategories),
      condition: stringValue(item.condition)
    }));
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
