import { beforeEach, describe, expect, test } from "vitest";
import { rehydrateAssistantText, scanDraft } from "./scan-session";

const store: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  globalThis.chrome = {
    storage: {
      session: {
        get(keys: string | string[], callback: (items: Record<string, unknown>) => void) {
          if (Array.isArray(keys)) {
            callback(Object.fromEntries(keys.map((key) => [key, store[key]])));
          } else {
            callback({ [keys]: store[keys] });
          }
        },
        set(items: Record<string, unknown>, callback?: () => void) {
          Object.assign(store, items);
          callback?.();
        }
      }
    }
  } as unknown as typeof chrome;
});

describe("Accord Guard scan session", () => {
  test("allows normal text with no sensitive entities", async () => {
    const result = await scan("Explain REST vs GraphQL.", "conversation:normal");

    expect(result.action).toBe("allow");
    expect(result.detectedEntityCount).toBe(0);
  });

  test("redacts sensitive person and email text", async () => {
    const result = await scan("Draft an email to John Smith at john@gmail.com.", "conversation:sensitive");

    expect(result.action).toBe("redact");
    expect(result.entityCounts.PERSON).toBe(1);
    expect(result.entityCounts.EMAIL).toBe(1);
    expect(result.decorations).toEqual([
      { type: "PERSON", start: 18, end: 28, placeholder: "[PERSON_1]" },
      { type: "EMAIL", start: 32, end: 46, placeholder: "[EMAIL_1]" }
    ]);
    expect(result.sanitizedText).toContain("[PERSON_1]");
    expect(result.sanitizedText).toContain("[EMAIL_1]");
  });

  test("keeps exact repeated entities stable in one conversation", async () => {
    const first = await scan("Tell John Smith the report is ready.", "conversation:stable");
    const second = await scan("Ask John Smith to review the new draft.", "conversation:stable");

    expect(first.sanitizedText).toContain("[PERSON_1]");
    expect(second.sanitizedText).toContain("[PERSON_1]");
  });

  test("numbers multiple people in conversation order", async () => {
    await scan("Tell John Smith the report is ready.", "conversation:people");
    const second = await scan("Ask Mary Jones to review the new draft.", "conversation:people");

    expect(second.sanitizedText).toContain("[PERSON_2]");
  });

  test("blocks fake credentials", async () => {
    const result = await scan("Use api_key=sk-1234567890abcdef to debug this.", "conversation:secret");

    expect(result.action).toBe("block");
    expect(result.decorations[0]).toMatchObject({
      type: "SECRET",
      placeholder: "[SECRET_1]"
    });
    expect(result.flags.some((flag) => flag.type === "secret")).toBe(true);
  });

  test("does not rehydrate unknown placeholders", async () => {
    await scan("Tell John Smith the report is ready.", "conversation:unknown");
    const result = await rehydrateAssistantText({
      surface: "chatgpt",
      conversationKey: "conversation:unknown",
      text: "Hi [PERSON_99]"
    });

    expect(result.text).toBe("Hi [PERSON_99]");
    expect(result.unresolvedPlaceholderCount).toBe(1);
  });

  test("rehydrates exact trusted placeholders", async () => {
    await scan("Tell John Smith the report is ready.", "conversation:trusted");
    const result = await rehydrateAssistantText({
      surface: "chatgpt",
      conversationKey: "conversation:trusted",
      text: "Hi [PERSON_1]"
    });

    expect(result.text).toBe("Hi John Smith");
    expect(result.replacedCount).toBe(1);
  });

  test("keeps conversation sessions separated", async () => {
    await scan("Tell John Smith the report is ready.", "conversation:a");
    const result = await rehydrateAssistantText({
      surface: "chatgpt",
      conversationKey: "conversation:b",
      text: "Hi [PERSON_1]"
    });

    expect(result.text).toBe("Hi [PERSON_1]");
  });
});

function scan(text: string, conversationKey: string) {
  return scanDraft({
    surface: "chatgpt",
    conversationKey,
    text,
    sensitivity: "Internal",
    authoritative: true,
    includeSanitizedText: true
  });
}
