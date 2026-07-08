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
    expect(result.resolvedText).toBe("Hi John Smith");
    expect(result.resolvedCount).toBe(1);
    expect(result.replacements).toEqual([
      {
        placeholder: "[PERSON_1]",
        type: "PERSON",
        start: 3,
        end: 13
      }
    ]);
    expect("redactionMap" in result).toBe(false);
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

  test.each([
    ["David O'Connor completed the technical review.", "David O'Connor"],
    ["Tell David O’Connor the report is ready.", "David O’Connor"],
    ["María José García approved the document.", "María José García"],
    ["Jean-Pierre Dubois sent the contract.", "Jean-Pierre Dubois"],
    ["José Luis Rodríguez signed the report.", "José Luis Rodríguez"],
    ["Anna van der Berg reviewed the memo.", "Anna van der Berg"],
    ["João da Silva called yesterday.", "João da Silva"],
    ["Wei Zhang approved the release.", "Wei Zhang"]
  ])("detects exact PERSON span for %s", async (text, expectedName) => {
    const result = await scan(text, `conversation:person:${text}`);
    const person = result.decorations.find((decoration) => decoration.type === "PERSON");

    expect(result.action).toBe("redact");
    expect(result.entityCounts.PERSON).toBe(1);
    expect(person).toBeDefined();
    expect(text.slice(person!.start, person!.end)).toBe(expectedName);
    expect(result.sanitizedText).toContain("[PERSON_1]");
  });

  test("detects lowercase names in a strong human-list context", async () => {
    const text = "write birthday invitations to my friends neta rogovsky, kevin trejos, brandon gizzo.";
    const result = await scan(text, "conversation:lowercase-list");

    expect(personSpans(text, result)).toEqual(["neta rogovsky", "kevin trejos", "brandon gizzo"]);
    expect(result.sanitizedText).toBe("write birthday invitations to my friends [PERSON_1], [PERSON_2], [PERSON_3].");
  });

  test.each([
    ["invite my friends david o'connor and maria garcia", ["david o'connor", "maria garcia"]],
    ["the attendees are jean-pierre dubois, anna van der berg, and jo\u00e3o da silva", ["jean-pierre dubois", "anna van der berg", "jo\u00e3o da silva"]],
    ["send this to kevin trejos", ["kevin trejos"]],
    ["cc mary jones and david o'connor", ["mary jones", "david o'connor"]],
    ["participants include wei zhang, li wei, and aisha bint ahmed", ["wei zhang", "li wei", "aisha bint ahmed"]],
    ["my coworkers neta rogovsky and brandon gizzo are coming", ["neta rogovsky", "brandon gizzo"]],
    ["email the recipients sarah connor, miles morales, peter parker", ["sarah connor", "miles morales", "peter parker"]]
  ])("detects lowercase context people: %s", async (text, expectedNames) => {
    const result = await scan(text, `conversation:lowercase:${text}`);

    expect(personSpans(text, result)).toEqual(expectedNames);
  });

  test("uses the same PERSON placeholder across capitalization changes", async () => {
    const first = await scan("Neta Rogovsky is attending.", "conversation:case-stable");
    const second = await scan("neta rogovsky is bringing dessert.", "conversation:case-stable");

    expect(first.sanitizedText).toContain("[PERSON_1]");
    expect(second.sanitizedText).toContain("[PERSON_1]");
    expect(second.sanitizedText).not.toContain("[PERSON_2]");
  });

  test.each([
    "Representational State Transfer is an architectural style.",
    "Customer Support Team owns this queue.",
    "Q3 Risk Review is finished.",
    "The Monday Client Meeting was moved.",
    "React State Update caused a rerender.",
    "New York Office is closing.",
    "Accord Guard is active.",
    "my friends list is stored in the database",
    "the people API returns customer records",
    "invite users to the platform",
    "participants include support team and product team",
    "send this to customer support",
    "the attendees endpoint is returning null",
    "friends net work status is down",
    "react state update and context provider",
    "birthday invitation template and customer email"
  ])("does not redact technical or product phrase: %s", async (text) => {
    const result = await scan(text, `conversation:negative:${text}`);

    expect(result.decorations.filter((decoration) => decoration.type === "PERSON")).toHaveLength(0);
  });
});

function personSpans(text: string, result: Awaited<ReturnType<typeof scan>>) {
  return result.decorations
    .filter((decoration) => decoration.type === "PERSON")
    .map((decoration) => text.slice(decoration.start, decoration.end));
}

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
