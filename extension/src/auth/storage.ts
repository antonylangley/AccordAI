import type { SupportedStorage } from "@supabase/supabase-js";

export const GUARD_AUTH_STORAGE_PREFIX = "accordGuardAuth:";
export const GUARD_PUBLIC_ACCOUNT_KEY = "accordGuardPublicAccount";

function storageArea() {
  return globalThis.chrome?.storage?.local;
}

export const chromeExtensionAuthStorage: SupportedStorage = {
  async getItem(key) {
    const storage = storageArea();
    if (!storage) return null;
    return new Promise((resolve) => {
      storage.get(`${GUARD_AUTH_STORAGE_PREFIX}${key}`, (items) => {
        const value = items[`${GUARD_AUTH_STORAGE_PREFIX}${key}`];
        resolve(typeof value === "string" ? value : null);
      });
    });
  },
  async setItem(key, value) {
    const storage = storageArea();
    if (!storage) return;
    await new Promise<void>((resolve) => {
      storage.set({ [`${GUARD_AUTH_STORAGE_PREFIX}${key}`]: value }, () => resolve());
    });
  },
  async removeItem(key) {
    const storage = storageArea();
    if (!storage) return;
    await new Promise<void>((resolve) => {
      storage.remove(`${GUARD_AUTH_STORAGE_PREFIX}${key}`, () => resolve());
    });
  }
};

export async function readStoredValue<T>(key: string): Promise<T | null> {
  const storage = storageArea();
  if (!storage) return null;
  return new Promise((resolve) => {
    storage.get(key, (items) => resolve((items[key] as T | undefined) ?? null));
  });
}

export async function writeStoredValue(key: string, value: unknown) {
  const storage = storageArea();
  if (!storage) return;
  await new Promise<void>((resolve) => storage.set({ [key]: value }, () => resolve()));
}

export async function removeStoredValue(key: string) {
  const storage = storageArea();
  if (!storage) return;
  await new Promise<void>((resolve) => storage.remove(key, () => resolve()));
}

export async function clearGuardAuthStorage() {
  const storage = storageArea();
  if (!storage) return;
  const values = await new Promise<Record<string, unknown>>((resolve) => storage.get(null, resolve));
  const keys = Object.keys(values).filter(
    (key) => key.startsWith(GUARD_AUTH_STORAGE_PREFIX) || key === GUARD_PUBLIC_ACCOUNT_KEY
  );
  if (!keys.length) return;
  await new Promise<void>((resolve) => storage.remove(keys, () => resolve()));
}
