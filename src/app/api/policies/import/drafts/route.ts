import { NextResponse } from "next/server";
import { createPolicyRulesFromInputs, type PolicyRuleDraftInput } from "@/lib/db/accord-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { companySlug?: unknown; rules?: unknown };
    const companySlug = typeof body.companySlug === "string" && body.companySlug.trim() ? body.companySlug.trim() : "test-company";
    const rules = Array.isArray(body.rules)
      ? body.rules.map(normalizeRule).filter((rule): rule is PolicyRuleDraftInput => Boolean(rule))
      : [];

    if (!rules.length) {
      return NextResponse.json({ error: "Choose at least one imported rule to save." }, { status: 400 });
    }

    const created = await createPolicyRulesFromInputs(rules, companySlug);

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
    name: stringValue(record.name),
    ruleKey: stringValue(record.ruleKey),
    sourceText: stringValue(record.sourceText),
    sourcePolicyName: stringValue(record.sourcePolicyName),
    sourceSection: stringValue(record.sourceSection),
    supportingExcerpt: stringValue(record.supportingExcerpt),
    requirementSummary: stringValue(record.requirementSummary),
    controlType: stringValue(record.controlType) as PolicyRuleDraftInput["controlType"],
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
    severity: stringValue(record.severity) as PolicyRuleDraftInput["severity"],
    conditionDescription: stringValue(record.conditionDescription),
    employeeExplanation: stringValue(record.employeeExplanation),
    reasoning: stringValue(record.reasoning),
    destinationAuthorizations: destinationAuthorizationsValue(record.destinationAuthorizations),
    confidence: numberValue(record.confidence),
    effectiveDate: stringValue(record.effectiveDate)
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringListValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
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
