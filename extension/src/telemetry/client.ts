import type { GuardTelemetryPayload } from "../messaging/types";
import { getApiBaseUrl } from "../auth/config";
import { getGuardAccessToken } from "../auth/session";

const INSTALL_ID_KEY = "accordGuardInstallId";

type StoredSettings = {
  [INSTALL_ID_KEY]?: string;
};

export async function recordGuardTelemetry(payload: GuardTelemetryPayload) {
  try {
    const accessToken = await getGuardAccessToken();
    if (!accessToken) return false;
    const [installId, apiBaseUrl] = await Promise.all([getInstallId(), getApiBaseUrl()]);
    const sanitized = sanitizeGuardTelemetryPayload(payload);
    const conversationKey = sanitized.conversationKey
      ? await hashConversationKeyLocally(sanitized.conversationKey)
      : undefined;
    const response = await fetch(`${apiBaseUrl}/api/guard/telemetry`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        ...sanitized,
        conversationKey,
        extensionInstallId: installId,
        occurredAt: new Date().toISOString()
      })
    });

    return response.ok;
  } catch (error) {
    console.info("[Accord Guard] telemetry unavailable", safeError(error));
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
  const allowed = new Set([
    "reasonCategory",
    "outcome",
    "scanId",
    "redacted",
    "enforcementSource",
    "findingSources",
    "responseId",
    "unresolvedPlaceholderCount",
    "batchAction",
    "actionList",
    "blockedReasonCategories"
  ]);
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => allowed.has(key))
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

    storage.get(INSTALL_ID_KEY, (items) => {
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

async function hashConversationKeyLocally(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeError(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError", message: "Telemetry request failed." };
}
