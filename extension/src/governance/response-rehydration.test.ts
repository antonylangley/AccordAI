import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";
import { rehydrateTextNodes } from "./response-rehydration";

describe("response rehydration", () => {
  test("skips literal placeholders inside code blocks", async () => {
    const dom = new JSDOM(`
      <article>
        <p>Hello [PERSON_1]</p>
        <pre><code>const sample = "[PERSON_1]";</code></pre>
      </article>
    `);
    globalThis.document = dom.window.document;
    globalThis.NodeFilter = dom.window.NodeFilter;
    const article = dom.window.document.querySelector("article") as HTMLElement;

    await rehydrateTextNodes(article, async (text) => text.replace("[PERSON_1]", "John Smith"));

    expect(article.querySelector("p")?.textContent).toBe("Hello John Smith");
    expect(article.querySelector("code")?.textContent).toBe('const sample = "[PERSON_1]";');
  });
});
