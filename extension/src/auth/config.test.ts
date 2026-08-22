import { beforeEach, describe, expect, test, vi } from "vitest";
import { ACCORD_API_BASE_URL_KEY, getApiBaseUrl, getGuardPublicConfig, resetGuardPublicConfigForTests } from "./config";

const store: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  resetGuardPublicConfigForTests();
  globalThis.chrome = {
    storage: {
      local: {
        get(key: string, callback: (items: Record<string, unknown>) => void) {
          callback({ [key]: store[key] });
        }
      }
    }
  } as unknown as typeof chrome;
  vi.unstubAllGlobals();
});

describe("Guard public configuration", () => {
  test("rejects a tampered API destination before authenticated requests use it", async () => {
    store[ACCORD_API_BASE_URL_KEY] = "https://attacker.invalid/collect";
    await expect(getApiBaseUrl()).resolves.toBe("https://www.accordgovernance.com");
  });

  test("allows explicit loopback development without allowing arbitrary HTTP origins", async () => {
    store[ACCORD_API_BASE_URL_KEY] = "http://127.0.0.1:3000/path";
    await expect(getApiBaseUrl()).resolves.toBe("http://127.0.0.1:3000");
  });

  test("accepts only public Supabase configuration fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        apiBaseUrl: "https://www.accordgovernance.com",
        supabaseUrl: "https://project.supabase.co",
        publishableKey: "public-anon-key",
        serviceRoleKey: "must-not-be-consumed"
      })
    })));

    await expect(getGuardPublicConfig()).resolves.toEqual({
      apiBaseUrl: "https://www.accordgovernance.com",
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "public-anon-key"
    });
  });
});
