import type { GuardTelemetryPayload } from "../messaging/types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";
const INSTALL_ID_KEY = "accordGuardInstallId";
const API_BASE_URL_KEY = "accordApiBaseUrl";
const COMPANY_SLUG_KEY = "accordCompanySlug";
const COMPANY_NAME_KEY = "accordCompanyName";
const USER_LABEL_KEY = "accordUserLabel";

type StoredSettings = {
  [INSTALL_ID_KEY]?: string;
  [API_BASE_URL_KEY]?: string;
  [COMPANY_SLUG_KEY]?: string;
  [COMPANY_NAME_KEY]?: string;
  [USER_LABEL_KEY]?: string;
};

export async function recordGuardTelemetry(payload: GuardTelemetryPayload) {
  try {
    const [installId, settings] = await Promise.all([getInstallId(), getSettings()]);
    const apiBaseUrl = sanitizeApiBaseUrl(settings[API_BASE_URL_KEY] || DEFAULT_API_BASE_URL);
    const response = await fetch(`${apiBaseUrl}/api/guard/telemetry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        ...sanitizeGuardTelemetryPayload(payload),
        extensionInstallId: installId,
        companySlug: settings[COMPANY_SLUG_KEY] || "test-company",
        companyName: settings[COMPANY_NAME_KEY] || "Test Company",
        userLabel: settings[USER_LABEL_KEY] || "Test User",
        occurredAt: new Date().toISOString()
      })
    });

    return response.ok;
  } catch (error) {
    console.info("[Accord Guard] telemetry unavailable", error);
    return false;
  }
}

export function sanitizeGuardTelemetryPayload(payload: GuardTelemetryPayload): GuardTelemetryPayload {
  return {
    eventType: payload.eventType,
    surface: payload.surface,
    conversationKey: payload.conversationKey,
    action: payload.action,
    riskScore: payload.riskScore,
    riskLevel: payload.riskLevel,
    flags: payload.flags,
    entityCounts: payload.entityCounts,
    redactionCount: payload.redactionCount,
    attachmentCount: payload.attachmentCount,
    messageLengthBucket: payload.messageLengthBucket,
    metadata: sanitizeMetadata(payload.metadata),
    organizationId: payload.organizationId,
    employeeUserId: payload.employeeUserId,
    ruleId: payload.ruleId,
    ruleKey: payload.ruleKey,
    ruleVersion: payload.ruleVersion,
    policyBundleVersion: payload.policyBundleVersion,
    policyAction: payload.policyAction,
    policySeverity: payload.policySeverity,
    aiProvider: payload.aiProvider,
    destinationType: payload.destinationType,
    contentType: payload.contentType,
    detectedCategories: payload.detectedCategories
  };
}

function sanitizeMetadata(metadata: GuardTelemetryPayload["metadata"]) {
  if (!metadata) return undefined;
  const forbidden = new Set(["text", "prompt", "rawprompt", "sanitizedtext", "originaltext", "content"]);
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !forbidden.has(key.replace(/[^a-z]/gi, "").toLocaleLowerCase()))
  );
}

export function messageLengthBucket(length: number) {
  if (length <= 0) return "empty";
  if (length <= 250) return "0-250";
  if (length <= 1000) return "251-1000";
  if (length <= 4000) return "1001-4000";
  return "4000+";
}

async function getInstallId() {
  const settings = await getSettings();
  const existing = settings[INSTALL_ID_KEY];
  if (existing) return existing;

  const installId = crypto.randomUUID();
  await setSettings({ [INSTALL_ID_KEY]: installId });
  return installId;
}

function getSettings(): Promise<StoredSettings> {
  return new Promise((resolve) => {
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) {
      resolve({});
      return;
    }

    storage.get([INSTALL_ID_KEY, API_BASE_URL_KEY, COMPANY_SLUG_KEY, COMPANY_NAME_KEY, USER_LABEL_KEY], (items) => {
      resolve(items as StoredSettings);
    });
  });
}

function setSettings(value: StoredSettings) {
  return new Promise<void>((resolve) => {
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) {
      resolve();
      return;
    }

    storage.set(value, () => resolve());
  });
}

function sanitizeApiBaseUrl(value: string) {
  return value.replace(/\/+$/, "") || DEFAULT_API_BASE_URL;
}
