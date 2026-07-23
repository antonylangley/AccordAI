import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, test } from "vitest";
import { ChatGPTAdapter } from "./chatgpt";

describe("ChatGPT adapter", () => {
  beforeEach(() => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      url: "https://chatgpt.com/"
    });
    installDomGlobals(dom);
  });

  test("scopes governed attachment interception to composer file inputs", () => {
    document.body.innerHTML = `
      <form data-testid="composer">
        <div id="prompt-textarea" contenteditable="true" role="textbox"></div>
        <input id="composer-file" type="file" multiple />
      </form>
      <input id="profile-avatar" type="file" accept="image/png" />
    `;
    const composer = document.querySelector("#prompt-textarea") as HTMLElement;
    const composerInput = document.querySelector("#composer-file") as HTMLInputElement;
    const unrelatedInput = document.querySelector("#profile-avatar") as HTMLInputElement;
    setRect(composer, { left: 120, top: 500, width: 620, height: 40 });

    const adapter = new ChatGPTAdapter();

    expect(adapter.isComposerAttachmentInput(composerInput)).toBe(true);
    expect(adapter.isComposerAttachmentInput(unrelatedInput)).toBe(false);
  });

  test("positions the composer emblem left of the composer and vertically centered", () => {
    document.body.innerHTML = `
      <form data-testid="composer">
        <div id="prompt-textarea" contenteditable="true" role="textbox"></div>
      </form>
      <div id="accord-guard-root"></div>
    `;
    const composer = document.querySelector("#prompt-textarea") as HTMLElement;
    const shell = document.querySelector("form") as HTMLElement;
    const root = document.querySelector("#accord-guard-root") as HTMLElement;
    setRect(composer, { left: 130, top: 510, width: 620, height: 36 });
    setRect(shell, { left: 120, top: 500, width: 640, height: 80 });
    setRect(root, { left: 0, top: 0, width: 70, height: 32 });
    setViewport(1000, 800);

    const adapter = new ChatGPTAdapter();
    adapter.positionGuardRoot(root);

    expect(root.dataset.attached).toBe("true");
    expect(root.style.left).toBe("36px");
    expect(root.style.top).toBe("524px");

    setRect(shell, { left: 120, top: 460, width: 640, height: 160 });
    adapter.positionGuardRoot(root);

    expect(root.style.top).toBe("524px");
  });

  test("verifies host attachment acceptance from a visible preview chip", async () => {
    document.body.innerHTML = `
      <div id="prompt-textarea" contenteditable="true" role="textbox"></div>
      <div data-testid="file-preview">customer.ts</div>
    `;
    setRect(document.querySelector("#prompt-textarea") as HTMLElement, { left: 120, top: 500, width: 620, height: 40 });
    setRect(document.querySelector("[data-testid='file-preview']") as HTMLElement, { left: 120, top: 450, width: 180, height: 32 });

    const adapter = new ChatGPTAdapter();

    await expect(adapter.verifyHostAttachmentAccepted([new File(["safe"], "customer.ts", { type: "application/typescript" })])).resolves.toBe(true);
  });

  test("verifies host attachment acceptance from ChatGPT library preview text", async () => {
    document.body.innerHTML = `
      <div id="prompt-textarea" contenteditable="true" role="textbox"></div>
      <section>
        <p>Library / <strong>customer.governed.txt</strong></p>
      </section>
    `;
    setRect(document.querySelector("#prompt-textarea") as HTMLElement, { left: 120, top: 500, width: 620, height: 40 });
    setRect(document.querySelector("section") as HTMLElement, { left: 120, top: 120, width: 260, height: 180 });
    setRect(document.querySelector("p") as HTMLElement, { left: 128, top: 128, width: 220, height: 24 });
    setRect(document.querySelector("strong") as HTMLElement, { left: 180, top: 128, width: 160, height: 24 });

    const adapter = new ChatGPTAdapter();

    await expect(adapter.verifyHostAttachmentAccepted([new File(["safe"], "customer.governed.txt", { type: "text/plain" })])).resolves.toBe(true);
  });
});

function installDomGlobals(dom: JSDOM) {
  globalThis.document = dom.window.document;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.location = dom.window.location;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLLabelElement = dom.window.HTMLLabelElement;
  globalThis.File = dom.window.File;
  globalThis.NodeFilter = dom.window.NodeFilter;
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

function setRect(element: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
  element.getBoundingClientRect = () =>
    ({
      ...rect,
      bottom: rect.top + rect.height,
      right: rect.left + rect.width,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({})
    }) as DOMRect;
}
