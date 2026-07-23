import { afterEach, describe, expect, test, vi } from "vitest";
import { sendGuardMessage } from "./client";
import type { AccordGuardMessage } from "./types";

const scanMessage: AccordGuardMessage = {
  type: "accord.scanDraft",
  payload: {
    surface: "chatgpt",
    conversationKey: "conversation:test",
    text: "hello",
    sensitivity: "Internal",
    authoritative: false,
    includeSanitizedText: false
  }
};

describe("sendGuardMessage", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "chrome");
    vi.restoreAllMocks();
  });

  test("returns a safe failure when the extension context is gone", async () => {
    globalThis.chrome = {
      runtime: undefined
    } as unknown as typeof chrome;

    await expect(sendGuardMessage(scanMessage)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining("Refresh ChatGPT")
    });
  });

  test("normalizes extension context invalidated rejections", async () => {
    globalThis.chrome = {
      runtime: {
        id: "accord-guard",
        sendMessage: vi.fn().mockRejectedValue(new Error("Extension context invalidated."))
      }
    } as unknown as typeof chrome;

    await expect(sendGuardMessage(scanMessage)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining("Refresh ChatGPT")
    });
  });
});
