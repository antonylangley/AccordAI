import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";
import type { RehydrateSafeResult } from "../messaging/types";
import { renderResolvedAssistantResponse } from "./response-rehydration";

describe("response rehydration presentation", () => {
  test("renders an aligned Accord overlay and copies only the selected resolved block", async () => {
    const dom = new JSDOM(`
      <main>
        <article data-message-author-role="assistant">
          <p>Here's a simple draft:</p>
          <p>Hey [PERSON_1], just wanted to let you know I'll send over the Q1 reports this afternoon.</p>
          <p>I can make it a little more polished or casual.</p>
          <pre><code>const sample = "[PERSON_1]";</code></pre>
        </article>
      </main>
    `);
    installDomGlobals(dom);
    const copied: string[] = [];
    const article = dom.window.document.querySelector("article") as HTMLElement;

    await renderResolvedAssistantResponse(article, "assistant_1", resolveText, {
      markUrl: "accord-mark.png",
      copyText: async (text) => {
        copied.push(text);
      }
    });

    expect(article.textContent).toContain("Hey [PERSON_1]");
    expect(article.querySelector("code")?.textContent).toBe('const sample = "[PERSON_1]";');
    expect(article.classList.contains("accord-guard-response-source-hidden")).toBe(true);

    const resolvedView = dom.window.document.querySelector(".accord-guard-response-overlay") as HTMLElement;
    expect(resolvedView).toBeTruthy();
    expect(resolvedView.previousElementSibling).toBe(article);
    expect(resolvedView.querySelector(".accord-guard-response-shell")).toBeNull();
    expect(resolvedView.textContent).toContain("Hey John Smith");
    expect(resolvedView.textContent).toContain("Here's a simple draft:");
    expect(resolvedView.textContent).toContain("I can make it a little more polished or casual.");
    expect(resolvedView.querySelector(".accord-guard-restored-identifier")?.textContent).toBe("John Smith");
    expect(resolvedView.querySelector("code")?.textContent).toBe('const sample = "[PERSON_1]";');

    const blockCopyButton = resolvedView.querySelector<HTMLButtonElement>(".accord-guard-block-copy");
    blockCopyButton?.click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    expect(copied[0]).toBe("Hey John Smith, just wanted to let you know I'll send over the Q1 reports this afternoon.");

    const popoverButtons = resolvedView.querySelectorAll<HTMLButtonElement>(".accord-guard-response-popover button");
    popoverButtons[1]?.click();
    expect(resolvedView.dataset.accordResponseMode).toBe("original");
    expect(article.classList.contains("accord-guard-response-source-hidden")).toBe(false);
    expect(resolvedView.querySelector(".accord-guard-response-original-preview")?.textContent).toContain("Hey [PERSON_1]");

    popoverButtons[2]?.click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    expect(copied[1]).toContain("Here's a simple draft:");
    expect(copied[1]).toContain("Hey John Smith");
    expect(copied[1]).toContain("I can make it a little more polished or casual.");
  });
});

function resolveText(text: string): Promise<RehydrateSafeResult> {
  const resolvedText = text.replace("[PERSON_1]", "John Smith");
  const start = resolvedText.indexOf("John Smith");

  return Promise.resolve({
    resolvedText,
    replacements:
      start >= 0
        ? [
            {
              placeholder: "[PERSON_1]",
              type: "PERSON",
              start,
              end: start + "John Smith".length
            }
          ]
        : [],
    resolvedCount: start >= 0 ? 1 : 0,
    unresolvedPlaceholders: [],
    text: resolvedText,
    replacedCount: start >= 0 ? 1 : 0,
    unresolvedPlaceholderCount: 0
  });
}

function installDomGlobals(dom: JSDOM) {
  globalThis.document = dom.window.document;
  globalThis.NodeFilter = dom.window.NodeFilter;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
}
