import { beforeEach, describe, expect, test } from "vitest";
import { debugPersonCandidateGenerationForTests, scanText } from "@accord/governance-core";
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
    expect(result.personDetection.nerStatus).toBe("unavailable");
    expect(result.personDetection.model.name).toBe("none");
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

  test("redacts credentials locally and continues", async () => {
    const result = await scan("Use api_key=sk-1234567890abcdef to debug this.", "conversation:secret");

    expect(result.action).toBe("redact");
    expect(result.decorations[0]).toMatchObject({
      type: "SECRET",
      placeholder: "[SECRET_1]"
    });
    expect(result.flags.some((flag) => flag.type === "secret")).toBe(true);
    expect(result.flags[0]?.source).toBe("accord_core");
    expect(result.enforcementSource).toBe("accord_core");
    expect(result.sanitizedText).not.toContain("sk-1234567890abcdef");
  });

  test.each([
    "Write an email to John about tomorrow's meeting.",
    "Explain how API keys work.",
    "Create an example environment variable called OPENAI_API_KEY.",
    "What is a Social Security number used for?",
    "Refactor this function to use async and await.",
    "Summarize this architecture and suggest clearer module names.",
    "The deployment identifier is abcdefghijklmnopqrstuvwxyz123456.",
    "Use this request correlation id: 0123456789abcdef0123456789abcdef.",
    "Explain how an API key should be stored without showing a real credential."
  ])("does not block or redact ordinary text: %s", async (text) => {
    const result = await scan(text, `conversation:safe-secret-regression:${text}`);

    expect(result.action).toBe("allow");
    expect(result.entityCounts.SECRET || 0).toBe(0);
  });

  test.each([
    ["Bearer abcdefghijklmnopqrstuvwxyz123456", "bearer token"],
    ['password="correct-horse-battery-staple"', "password assignment"],
    ["-----BEGIN PRIVATE KEY-----\nabc123def456ghi789\n-----END PRIVATE KEY-----", "private key"]
  ])("redacts an actual %s", async (text) => {
    const result = await scan(text, `conversation:positive-secret:${text}`);

    expect(result.action).toBe("redact");
    expect(result.entityCounts.SECRET).toBe(1);
    expect(result.sanitizedText).toContain("[SECRET_1]");
    expect(result.sanitizedText).not.toContain(text);
  });

  test("redacts multiple secrets in one prompt", async () => {
    const result = await scan(
      "Use sk-1234567890abcdef and Bearer abcdefghijklmnopqrstuvwxyz123456 for this migration.",
      "conversation:multiple-secrets"
    );

    expect(result.action).toBe("redact");
    expect(result.entityCounts.SECRET).toBe(2);
    expect(result.sanitizedText).toContain("[SECRET_1]");
    expect(result.sanitizedText).toContain("[SECRET_2]");
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

  test("rehydrates a new ChatGPT conversation from the recent governed draft vault", async () => {
    await scan("Write an email to Jordan Example at jordan.example@test.com.", "draft:new-chat");
    const result = await rehydrateAssistantText({
      surface: "chatgpt",
      conversationKey: "conversation:new-chat",
      text: "Dear [PERSON_1], I will email [EMAIL_1]."
    });

    expect(result.text).toBe("Dear Jordan Example, I will email jordan.example@test.com.");
    expect(result.replacedCount).toBe(2);
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
    ["Nguyễn Văn An approved the memo.", "Nguyễn Văn An"],
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

  test("accepts externally supplied Unicode PERSON candidates only when offsets exactly match", () => {
    const text = "met maría josé garcía after the review";
    const start = text.indexOf("maría");
    const exactName = "maría josé garcía";
    const exact = scanText(text, "preflight", "Internal", {
      additionalCandidates: [
        {
          type: "PERSON",
          originalText: exactName,
          start,
          end: start + exactName.length,
          confidence: 0.94,
          detector: "local_ner_candidate_test",
          contextSignals: ["ner_person"]
        }
      ]
    });
    const mismatched = scanText(text, "preflight", "Internal", {
      additionalCandidates: [
        {
          type: "PERSON",
          originalText: "María José García",
          start,
          end: start + exactName.length,
          confidence: 0.99,
          detector: "local_ner_candidate_test",
          contextSignals: ["ner_person"]
        }
      ]
    });

    expect(exact.entities).toEqual([
      expect.objectContaining({
        type: "PERSON",
        originalText: exactName,
        start,
        end: start + exactName.length,
        id: "[PERSON_1]"
      })
    ]);
    expect(text.slice(exact.entities[0].start, exact.entities[0].end)).toBe(exactName);
    expect(mismatched.entities).toEqual([]);
  });

  test("detects lowercase names in a strong human-list context", async () => {
    const text = "write birthday invitations to my friends neta rogovsky, kevin trejos, brandon gizzo.";
    const result = await scan(text, "conversation:lowercase-list");

    expect(personSpans(text, result)).toEqual(["neta rogovsky", "kevin trejos", "brandon gizzo"]);
    expect(result.sanitizedText).toBe("write birthday invitations to my friends [PERSON_1], [PERSON_2], [PERSON_3].");
  });

  test("detects coordinated lowercase names after a human action", async () => {
    const text = "email neta rogovsky and kevin trejos abt saturday";
    const result = await scan(text, "conversation:coordinated-failure");

    expect(result.action).toBe("redact");
    expect(result.detectedEntityCount).toBe(2);
    expect(result.entityCounts.PERSON).toBe(2);
    expect(personSpans(text, result)).toEqual(["neta rogovsky", "kevin trejos"]);
    expect(result.sanitizedText).toBe("email [PERSON_1] and [PERSON_2] abt saturday");
  });

  test.each([
    ["email neta rogovsky", ["neta rogovsky"], "email [PERSON_1]"],
    ["email neta rogovsky and", ["neta rogovsky"], "email [PERSON_1] and"],
    ["email neta rogovsky and kevin trejos", ["neta rogovsky", "kevin trejos"], "email [PERSON_1] and [PERSON_2]"],
    [
      "email neta rogovsky and kevin trejos abt saturday",
      ["neta rogovsky", "kevin trejos"],
      "email [PERSON_1] and [PERSON_2] abt saturday"
    ]
  ])("keeps coordinated lowercase names stable while typing: %s", async (text, expectedNames, expectedSanitizedText) => {
    const result = await scan(text, `conversation:incremental:${text}`);

    expect(personSpans(text, result)).toEqual(expectedNames);
    expect(result.sanitizedText).toBe(expectedSanitizedText);
  });

  test("exposes deterministic coordinated candidate debug evidence for tests", () => {
    const text = "email neta rogovsky and kevin trejos abt saturday";
    const candidates = debugPersonCandidateGenerationForTests(text).filter((candidate) =>
      candidate.source === "coordinated_human_sequence" && ["neta rogovsky", "kevin trejos"].includes(candidate.text)
    );

    expect(candidates).toEqual([
      expect.objectContaining({
        text: "neta rogovsky",
        start: 6,
        end: 19,
        source: "coordinated_human_sequence",
        contextSignals: expect.arrayContaining(["human_action_context", "coordinated_human_context"])
      }),
      expect.objectContaining({
        text: "kevin trejos",
        start: 24,
        end: 36,
        source: "coordinated_human_sequence",
        contextSignals: expect.arrayContaining(["inherited_human_action_context", "coordinated_human_context"])
      })
    ]);
  });

  test.each([
    ["invite my friends david o'connor and maria garcia", ["david o'connor", "maria garcia"]],
    ["the attendees are jean-pierre dubois, anna van der berg, and jo\u00e3o da silva", ["jean-pierre dubois", "anna van der berg", "jo\u00e3o da silva"]],
    ["send this to kevin trejos", ["kevin trejos"]],
    ["cc mary jones and david o'connor", ["mary jones", "david o'connor"]],
    ["participants include wei zhang, li wei, and aisha bint ahmed", ["wei zhang", "li wei", "aisha bint ahmed"]],
    ["my coworkers neta rogovsky and brandon gizzo are coming", ["neta rogovsky", "brandon gizzo"]],
    ["email the recipients sarah connor, miles morales, peter parker", ["sarah connor", "miles morales", "peter parker"]],
    ["ask john smith and mary jones to review it", ["john smith", "mary jones"]],
    ["cc david o'connor and maria garcia", ["david o'connor", "maria garcia"]],
    ["message jean-pierre dubois, anna van der berg and wei zhang", ["jean-pierre dubois", "anna van der berg", "wei zhang"]],
    ["invite neta rogovsky, kevin trejos, and brandon gizzo", ["neta rogovsky", "kevin trejos", "brandon gizzo"]],
    ["tell jo\u00e3o da silva and mar\u00eda jos\u00e9 garc\u00eda the meeting moved", ["jo\u00e3o da silva", "mar\u00eda jos\u00e9 garc\u00eda"]],
    ["send this to li wei and aisha bint ahmed", ["li wei", "aisha bint ahmed"]],
    ["email sarah connor; miles morales; peter parker about the launch", ["sarah connor", "miles morales", "peter parker"]]
  ])("detects lowercase context people: %s", async (text, expectedNames) => {
    const result = await scan(text, `conversation:lowercase:${text}`);

    expect(personSpans(text, result)).toEqual(expectedNames);
  });

  test("keeps coordinated lowercase placeholders stable across later prompts", async () => {
    const firstText = "email neta rogovsky and kevin trejos abt saturday";
    const secondText = "ask kevin trejos to bring drinks and tell neta rogovsky to come early";
    const first = await scan(firstText, "conversation:coordinated-stable");
    const second = await scan(secondText, "conversation:coordinated-stable");

    expect(first.sanitizedText).toBe("email [PERSON_1] and [PERSON_2] abt saturday");
    expect(second.sanitizedText).toBe("ask [PERSON_2] to bring drinks and tell [PERSON_1] to come early");
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
    "birthday invitation template and customer email",
    "email support and sales about saturday",
    "ask product and engineering to review it",
    "message customer support and account management",
    "tell react state and context provider to update",
    "email the report and contract",
    "copy files and folders",
    "invite users and admins",
    "friends and family plan"
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
