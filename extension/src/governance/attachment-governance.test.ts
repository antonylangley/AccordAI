import { beforeEach, describe, expect, test } from "vitest";
import { MAX_GUARDED_TEXT_ATTACHMENT_BYTES } from "../attachments/policy";
import { governAttachmentBatch, rehydrateAssistantText, scanDraft } from "./scan-session";

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

describe("Accord Guard attachment governance", () => {
  test("A: allows clean text as an equivalent governed file", async () => {
    const result = await govern([file("notes.txt", "hello world")], "attachments:clean-text");

    expect(result.batchAction).toBe("allow");
    expect(result.results[0]).toMatchObject({
      action: "clean",
      sanitizedName: "notes.txt",
      reason: "notes.txt governed locally."
    });
    expect(result.results[0].sanitizedText).toBe("hello world");
  });

  test("allows clean code as an equivalent governed file", async () => {
    const result = await govern([file("app.ts", "export function add(a: number, b: number) {\n  return a + b;\n}")], "attachments:clean");

    expect(result.batchAction).toBe("allow");
    expect(result.results[0]).toMatchObject({
      action: "clean",
      sanitizedName: "app.ts"
    });
    expect(result.results[0].sanitizedText).toContain("return a + b");
  });

  test("B: redacts PII inside source code and returns the governed copy", async () => {
    const result = await govern(
      [
        file(
          "customer.ts",
          'const customer = {\n  name: "Brian McGinty",\n  email: "brian.mcginty@example.com",\n};'
        )
      ],
      "attachments:pii"
    );

    expect(result.batchAction).toBe("allow");
    expect(result.results[0].action).toBe("redacted");
    expect(result.results[0].entityCounts).toMatchObject({
      PERSON: 1,
      EMAIL: 1
    });
    expect(result.results[0].reason).toContain("2 identifiers protected in customer.ts");
    expect(result.results[0].sanitizedText).toContain("[PERSON_1]");
    expect(result.results[0].sanitizedText).toContain("[EMAIL_1]");
    expect(result.results[0].sanitizedText).toBe('const customer = {\n  name: "[PERSON_1]",\n  email: "[EMAIL_1]",\n};');
    expect(result.results[0].sanitizedText).not.toContain("Brian McGinty");
    expect(result.results[0].sanitizedText).not.toContain("brian.mcginty@example.com");
  });

  test("C: blocks source code containing a possible credential", async () => {
    const result = await govern([file("config.ts", 'const api_key = "sk-test-1234567890abcdef";')], "attachments:secret");

    expect(result.batchAction).toBe("block");
    expect(result.results[0]).toMatchObject({
      action: "blocked",
      sanitizedText: undefined
    });
    expect(result.summary).toContain("Possible credential detected");
    expect(result.summary).toContain("config.ts was not uploaded");
  });

  test("D: governs names in filenames before host handoff", async () => {
    const result = await govern([file("John_Smith_review.txt", "Review is complete.")], "attachments:filename");

    expect(result.batchAction).toBe("allow");
    expect(result.results[0].sanitizedName).toContain("[PERSON_1]");
    expect(result.results[0].sanitizedName).not.toContain("John");
    expect(result.results[0].sanitizedName).not.toContain("Smith");
  });

  test("E: shares prompt and attachment placeholder vault", async () => {
    await scanDraft({
      surface: "chatgpt",
      conversationKey: "attachments:shared",
      text: "Ask John Smith to review the file.",
      sensitivity: "Internal",
      authoritative: true,
      includeSanitizedText: true
    });

    const result = await govern([file("reviewer.ts", 'const reviewer = "John Smith";')], "attachments:shared");

    expect(result.batchAction).toBe("allow");
    expect(result.results[0].sanitizedText).toContain("[PERSON_1]");
    expect(result.results[0].sanitizedText).not.toContain("[PERSON_2]");
  });

  test("F: redacts multiple people and rehydrates later response placeholders", async () => {
    const result = await govern(
      [file("approvals.ts", 'const approver = "Mary Jones";\nconst reviewer = "David O\'Connor";')],
      "attachments:multiple"
    );

    expect(result.batchAction).toBe("allow");
    expect(result.results[0].sanitizedText).toContain("[PERSON_1]");
    expect(result.results[0].sanitizedText).toContain("[PERSON_2]");

    const resolved = await rehydrateAssistantText({
      surface: "chatgpt",
      conversationKey: "attachments:multiple",
      text: "[PERSON_1] and [PERSON_2] should review this function."
    });

    expect(resolved.text).toContain("Mary Jones");
    expect(resolved.text).toContain("David O'Connor");
  });

  test("redacts lowercase human-list names in governed source attachments", async () => {
    const result = await govern(
      [
        file(
          "guests.ts",
          'const guests = [\n  "neta rogovsky",\n  "kevin trejos",\n  "brandon gizzo"\n];'
        )
      ],
      "attachments:lowercase-guests"
    );

    expect(result.batchAction).toBe("allow");
    expect(result.results[0].sanitizedText).toContain("[PERSON_1]");
    expect(result.results[0].sanitizedText).toContain("[PERSON_2]");
    expect(result.results[0].sanitizedText).toContain("[PERSON_3]");
    expect(result.results[0].sanitizedText).not.toContain("neta rogovsky");
    expect(result.results[0].sanitizedText).not.toContain("kevin trejos");
    expect(result.results[0].sanitizedText).not.toContain("brandon gizzo");
  });

  test("redacts coordinated lowercase recipients in governed source attachments", async () => {
    const result = await govern(
      [
        file(
          "recipients.ts",
          'const recipients = [\n  "neta rogovsky",\n  "kevin trejos"\n];'
        )
      ],
      "attachments:lowercase-recipients"
    );

    expect(result.batchAction).toBe("allow");
    expect(result.results[0].sanitizedText).toContain("[PERSON_1]");
    expect(result.results[0].sanitizedText).toContain("[PERSON_2]");
    expect(result.results[0].sanitizedText).not.toContain("neta rogovsky");
    expect(result.results[0].sanitizedText).not.toContain("kevin trejos");
  });

  test("G: fails closed for unsupported files", async () => {
    const result = await govern([file("report.pdf", "", "application/pdf")], "attachments:unsupported");

    expect(result.batchAction).toBe("block");
    expect(result.results[0].action).toBe("unsupported");
    expect(result.summary).toContain("not governed in browser mode yet");
    expect(result.summary).toContain("report.pdf was not uploaded");
    expect(result.summary).toContain("Use Accord Workspace");
  });

  test("H: fails closed for supported files over the browser-mode limit", async () => {
    const result = await govern([file("large.txt", undefined, "text/plain", MAX_GUARDED_TEXT_ATTACHMENT_BYTES + 1)], "attachments:large");

    expect(result.batchAction).toBe("block");
    expect(result.results[0].action).toBe("too_large");
    expect(result.summary).toContain("too large");
  });

  test("privacy boundary: safe result does not return raw sensitive filename or content", async () => {
    const result = await govern([file("John_Smith_notes.txt", "Email John Smith at john@gmail.com.")], "attachments:privacy");
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("John_Smith_notes");
    expect(serialized).not.toContain("Email John Smith");
    expect(serialized).not.toContain("john@gmail.com");
  });

  test("does not reject supported code solely because the browser reports generic MIME", async () => {
    const result = await govern(
      [file("customer.ts", 'export const customer = {\n  status: "active",\n};', "application/octet-stream")],
      "attachments:generic-mime"
    );

    expect(result.batchAction).toBe("allow");
    expect(result.results[0]).toMatchObject({
      action: "clean",
      sanitizedName: "customer.ts"
    });
    expect(result.results[0].telemetry.mimeCategory).toBe("code");
  });

  test("fails closed when a known extension contains binary-looking content", async () => {
    const result = await govern([file("fake.ts", "\u0000\u0001\u0002binary", "application/octet-stream")], "attachments:binary");

    expect(result.batchAction).toBe("block");
    expect(result.results[0].action).toBe("binary");
    expect(result.summary).toContain("appears to contain binary data");
    expect(result.summary).toContain("fake.ts");
  });

  test("blocks the whole batch and names the attachment that caused the failure", async () => {
    const result = await govern(
      [
        file("customer.ts", 'export const customer = {\n  status: "active",\n};'),
        file("config.ts", 'const api_key = "sk-test-1234567890abcdef";')
      ],
      "attachments:mixed-batch"
    );

    expect(result.batchAction).toBe("block");
    expect(result.summary).toBe("2-file upload blocked. config.ts contains a possible credential. Neither file was uploaded.");
    expect(result.results[0].sanitizedText).toBeUndefined();
    expect(result.results[1].sanitizedText).toBeUndefined();
  });
});

function file(name: string, text = "", mimeType = "text/plain", size = new TextEncoder().encode(text).length) {
  return {
    id: crypto.randomUUID(),
    originalName: name,
    size,
    mimeType,
    lastModified: 123,
    text: size <= MAX_GUARDED_TEXT_ATTACHMENT_BYTES ? text : undefined
  };
}

function govern(attachments: ReturnType<typeof file>[], conversationKey: string) {
  return governAttachmentBatch({
    surface: "chatgpt",
    conversationKey,
    sensitivity: "Internal",
    attachments
  });
}
