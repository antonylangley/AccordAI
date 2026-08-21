import { POLICY_SCHEMA_VERSION, type BuiltInPolicyBundleDefinition, type InternalPolicyRule, type PublishedEnforcementBundle } from "./types";

const categories = new Set(["CLIENT_VETERINARY_DATA", "CONFIDENTIAL_BUSINESS", "EXTERNAL_AI_USAGE", "EMPLOYEE_HR", "SECURITY_CREDENTIALS"]);
const severities = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const actions = new Set(["ALLOW", "REDACT", "HOLD", "BLOCK"]);
const sourceTypes = new Set(["accord_builtin", "organization_policy"]);
const providerModes = new Set(["any", "approved_only", "unapproved_only"]);

export function validateInternalPolicyRule(value: unknown): value is InternalPolicyRule {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== POLICY_SCHEMA_VERSION) return false;
  if (!nonEmpty(value.id) || !positiveInteger(value.version) || !nonEmpty(value.title) || !nonEmpty(value.description)) return false;
  if (!categories.has(String(value.category)) || !severities.has(String(value.severity)) || !actions.has(String(value.action))) return false;
  if (value.fallbackAction != null && !actions.has(String(value.fallbackAction))) return false;
  if (!isRecord(value.source) || !sourceTypes.has(String(value.source.type))) return false;
  if (!isRecord(value.scope) || typeof value.scope.enabled !== "boolean") return false;
  if (value.scope.providerMode != null && !providerModes.has(String(value.scope.providerMode))) return false;
  if (!isRecord(value.match) || !isRecord(value.explanation) || !nonEmpty(value.explanation.short)) return false;
  return true;
}

export function validateBuiltInPolicyBundle(value: unknown): value is BuiltInPolicyBundleDefinition {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === POLICY_SCHEMA_VERSION &&
    nonEmpty(value.id) &&
    positiveInteger(value.version) &&
    nonEmpty(value.name) &&
    nonEmpty(value.description) &&
    typeof value.defaultEnabled === "boolean" &&
    Array.isArray(value.rules) &&
    value.rules.length > 0 &&
    value.rules.every(validateInternalPolicyRule)
  );
}

export function validatePublishedEnforcementBundle(value: unknown): value is PublishedEnforcementBundle {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === POLICY_SCHEMA_VERSION &&
    nonEmpty(value.id) &&
    nonEmpty(value.companySlug) &&
    positiveInteger(value.version) &&
    (value.status === "published" || value.status === "superseded") &&
    nonEmpty(value.checksum) &&
    Array.isArray(value.enabledBuiltInBundleIds) &&
    Array.isArray(value.approvedProviders) &&
    Array.isArray(value.rules) &&
    value.rules.every(validateInternalPolicyRule)
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
