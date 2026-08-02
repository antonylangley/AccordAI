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
    sourcePolicyName: stringValue(record.sourcePolicyName),
    sourceSection: stringValue(record.sourceSection),
    supportingExcerpt: stringValue(record.supportingExcerpt),
    dataCategories: Array.isArray(record.dataCategories) ? record.dataCategories.filter((item): item is string => typeof item === "string") : stringValue(record.dataCategories),
    userScope: stringValue(record.userScope),
    departmentScope: stringValue(record.departmentScope),
    aiProvider: stringValue(record.aiProvider),
    destinationType: stringValue(record.destinationType) as PolicyRuleDraftInput["destinationType"],
    action: stringValue(record.action) as PolicyRuleDraftInput["action"],
    fallbackAction: stringValue(record.fallbackAction) as PolicyRuleDraftInput["fallbackAction"],
    severity: stringValue(record.severity) as PolicyRuleDraftInput["severity"],
    employeeExplanation: stringValue(record.employeeExplanation),
    effectiveDate: stringValue(record.effectiveDate)
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
