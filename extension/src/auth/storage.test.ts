import { beforeEach, describe, expect, test } from "vitest";
import {
  chromeExtensionAuthStorage,
  clearGuardAuthStorage,
  GUARD_AUTH_STORAGE_PREFIX,
  GUARD_PUBLIC_ACCOUNT_KEY,
  readStoredValue,
  writeStoredValue
} from "./storage";

const store: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  globalThis.chrome = {
    storage: {
      local: {
        get(keys: string | string[] | null, callback: (items: Record<string, unknown>) => void) {
          if (keys === null) return callback({ ...store });
          const keyList = Array.isArray(keys) ? keys : [keys];
          callback(Object.fromEntries(keyList.map((key) => [key, store[key]])));
        },
        set(items: Record<string, unknown>, callback?: () => void) {
          Object.assign(store, items);
          callback?.();
        },
        remove(keys: string | string[], callback?: () => void) {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
          callback?.();
        }
      }
    }
  } as unknown as typeof chrome;
});

describe("Guard auth storage", () => {
  test("keeps Supabase session material in extension-owned storage", async () => {
    await chromeExtensionAuthStorage.setItem("session", "private-session-json");

    expect(store[`${GUARD_AUTH_STORAGE_PREFIX}session`]).toBe("private-session-json");
    await expect(chromeExtensionAuthStorage.getItem("session")).resolves.toBe("private-session-json");
  });

  test("stores only the public account snapshot at the public key", async () => {
    const snapshot = { status: "signed_out", localProtection: true };
    await writeStoredValue(GUARD_PUBLIC_ACCOUNT_KEY, snapshot);

    await expect(readStoredValue(GUARD_PUBLIC_ACCOUNT_KEY)).resolves.toEqual(snapshot);
    expect(Object.keys(store).some((key) => key.startsWith(GUARD_AUTH_STORAGE_PREFIX))).toBe(false);
  });

  test("sign-out clears auth state without deleting policy or installation caches", async () => {
    store[`${GUARD_AUTH_STORAGE_PREFIX}session`] = "private-session-json";
    store[GUARD_PUBLIC_ACCOUNT_KEY] = { status: "authenticated" };
    store["accordPolicyBundle:org_1"] = { version: 3 };
    store.accordGuardInstallId = "install_1";

    await clearGuardAuthStorage();

    expect(store).toEqual({
      "accordPolicyBundle:org_1": { version: 3 },
      accordGuardInstallId: "install_1"
    });
  });
});
