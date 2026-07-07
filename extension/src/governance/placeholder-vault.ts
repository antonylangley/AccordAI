import type { RedactionMap } from "@accord/governance-core";
import type { AISurface } from "../adapters/types";
import type { MoveVaultPayload } from "../messaging/types";

type StoredVault = {
  redactionMap: RedactionMap;
  updatedAt: number;
};

export class PlaceholderVault {
  async load(surface: AISurface, conversationKey: string): Promise<RedactionMap> {
    const key = storageKey(surface, conversationKey);
    const result = await storageGet(key);
    const vault = result[key] as StoredVault | undefined;
    return vault?.redactionMap || {};
  }

  async merge(surface: AISurface, conversationKey: string, additions: RedactionMap) {
    const safeAdditions = withoutSecrets(additions);
    if (!Object.keys(safeAdditions).length) return;

    const current = await this.load(surface, conversationKey);
    await storageSet({
      [storageKey(surface, conversationKey)]: {
        redactionMap: {
          ...current,
          ...safeAdditions
        },
        updatedAt: Date.now()
      } satisfies StoredVault
    });
  }

  async move({ surface, fromConversationKey, toConversationKey }: MoveVaultPayload) {
    if (fromConversationKey === toConversationKey) return;
    const fromKey = storageKey(surface, fromConversationKey);
    const toKey = storageKey(surface, toConversationKey);
    const result = await storageGet([fromKey, toKey]);
    const fromVault = result[fromKey] as StoredVault | undefined;
    if (!fromVault?.redactionMap) return;
    const toVault = result[toKey] as StoredVault | undefined;

    await storageSet({
      [toKey]: {
        redactionMap: {
          ...(toVault?.redactionMap || {}),
          ...fromVault.redactionMap
        },
        updatedAt: Date.now()
      } satisfies StoredVault
    });
  }
}

export function storageKey(surface: AISurface, conversationKey: string) {
  return `accord.guard.vault.${surface}.${conversationKey.replace(/[^a-zA-Z0-9:_-]/g, "_")}`;
}

function withoutSecrets(redactionMap: RedactionMap): RedactionMap {
  return Object.fromEntries(Object.entries(redactionMap).filter(([, value]) => value.type !== "SECRET"));
}

function storageGet(keys: string | string[]) {
  return new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.session.get(keys, (items) => resolve(items || {}));
  });
}

function storageSet(items: Record<string, unknown>) {
  return new Promise<void>((resolve) => {
    chrome.storage.session.set(items, () => resolve());
  });
}
