import { beforeEach, describe, expect, test, vi } from "vitest";
import { recordGuardTelemetry, sanitizeGuardTelemetryPayload } from "./client";

const auth = vi.hoisted(() => ({ token: vi.fn(), apiBaseUrl: vi.fn() }));
vi.mock("../auth/session", () => ({ getGuardAccessToken: auth.token }));
vi.mock("../auth/config", () => ({ getApiBaseUrl: auth.apiBaseUrl }));

const store: Record<string, unknown> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(store)) delete store[key];
  auth.token.mockResolvedValue("test-access-token");
  auth.apiBaseUrl.mockResolvedValue("https://www.accordgovernance.com");
  globalThis.chrome = {
    storage: {
      local: {
        get(keys: string | string[], callback: (items: Record<string, unknown>) => void) {
          const keyList = Array.isArray(keys) ? keys : [keys];
          callback(Object.fromEntries(keyList.map((key) => [key, store[key]])));
        },
        set(items: Record<string, unknown>, callback?: () => void) {
          Object.assign(store, items);
          callback?.();
        }
      }
    }
  } as unknown as typeof chrome;
  vi.unstubAllGlobals();
});

describe("telemetry privacy boundary", () => {
  test("retains policy metadata and drops raw-content-shaped fields", () => {
    const payload = sanitizeGuardTelemetryPayload({
      eventType: "message_blocked",
      surface: "chatgpt",
      conversationKey: "conversation-hash",
      ruleId: "accord.confidential.unpublished-financials",
      policyAction: "HOLD",
      detectedCategories: ["unpublished_financials"],
      metadata: {
        enforcementSource: "accord_builtin",
        summary: "synthetic summary must not leave browser",
        prompt: "synthetic raw prompt must not leave browser",
        originalText: "synthetic detected value"
      }
    });

    expect(payload.ruleId).toBe("accord.confidential.unpublished-financials");
    expect(payload.metadata).toEqual({ enforcementSource: "accord_builtin" });
    expect(JSON.stringify(payload)).not.toContain("synthetic raw prompt");
    expect(JSON.stringify(payload)).not.toContain("synthetic detected value");
    expect(JSON.stringify(payload)).not.toContain("synthetic summary");
  });

  test("does not copy unknown top-level raw fields", () => {
    const unsafe = {
      eventType: "message_sent_to_ai",
      surface: "chatgpt",
      conversationKey: "conversation-hash",
      rawPrompt: "synthetic raw prompt"
    } as Parameters<typeof sanitizeGuardTelemetryPayload>[0];

    expect(sanitizeGuardTelemetryPayload(unsafe)).not.toHaveProperty("rawPrompt");
  });

  test("does not accept browser-supplied organization or employee identity", () => {
    const payload = sanitizeGuardTelemetryPayload({
      eventType: "message_blocked",
      surface: "chatgpt",
      conversationKey: "conversation-hash",
      organizationId: "forged-organization",
      employeeUserId: "forged-user"
    });

    expect(payload).not.toHaveProperty("organizationId");
    expect(payload).not.toHaveProperty("employeeUserId");
  });

  test("posts attributed metadata with a bearer token and locally hashes the conversation key", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, init }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(recordGuardTelemetry({
      eventType: "message_sent_to_ai",
      surface: "chatgpt",
      conversationKey: "raw-conversation-id",
      entityCounts: { PERSON: 1 },
      metadata: { enforcementSource: "accord_core" }
    })).resolves.toBe(true);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(init?.headers).toEqual({ Authorization: "Bearer test-access-token", "Content-Type": "application/json" });
    expect(body.conversationKey).toMatch(/^[a-f0-9]{64}$/);
    expect(body.conversationKey).not.toBe("raw-conversation-id");
    expect(body).not.toHaveProperty("companySlug");
    expect(body).not.toHaveProperty("organizationId");
    expect(body).not.toHaveProperty("employeeUserId");
  });

  test("does not send telemetry while signed out", async () => {
    auth.token.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(recordGuardTelemetry({
      eventType: "message_sent_to_ai",
      surface: "chatgpt",
      conversationKey: "conversation-hash"
    })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
