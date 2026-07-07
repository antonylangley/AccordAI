import type { AISurfaceAdapter, ComposerDecorationState, SubmissionController, SurfaceAssistantResponse } from "./types";

const composerSelectors = [
  "#prompt-textarea",
  "textarea[data-testid='prompt-textarea']",
  "textarea[placeholder*='Message']",
  "div.ProseMirror[contenteditable='true']",
  "[contenteditable='true'][role='textbox']",
  "[contenteditable='true'][data-testid*='prompt']"
];

const sendButtonSelectors = [
  "button[data-testid='send-button']",
  "button[aria-label='Send prompt']",
  "button[aria-label='Send message']",
  "button:has(svg[aria-label='Send prompt'])"
];

const assistantSelectors = [
  "[data-message-author-role='assistant']",
  "article[data-testid*='conversation-turn'][data-message-author-role='assistant']",
  "[data-testid*='conversation-turn'] [data-message-author-role='assistant']"
];

const attachmentSelectors = [
  "[data-testid*='attachment']",
  "[aria-label*='Attachment']",
  "[aria-label*='file']",
  "input[type='file']"
];

const decorationClass = "accord-guard-composer";

export class ChatGPTAdapter implements AISurfaceAdapter {
  readonly surface = "chatgpt" as const;
  private lastComposer: HTMLElement | null = null;
  private lastRoute = location.href;

  isCurrentSurface() {
    return location.hostname === "chatgpt.com";
  }

  findComposer() {
    const composer = composerSelectors
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .find((element): element is HTMLElement => Boolean(element && isVisible(element)));

    if (composer && composer !== this.lastComposer) {
      console.info("[Accord Guard] ChatGPT composer located");
      this.lastComposer = composer;
    }

    if (!composer && this.lastComposer) {
      console.info("[Accord Guard] composer unavailable");
      this.lastComposer = null;
    }

    return composer || null;
  }

  getDraftText() {
    const composer = this.findComposer();
    if (!composer) return "";
    if (isTextArea(composer)) return composer.value;
    return normalizeComposerText(composer.innerText || composer.textContent || "");
  }

  async setDraftText(text: string) {
    const composer = this.findComposer();
    if (!composer) throw new Error("ChatGPT composer unavailable.");

    composer.focus();

    if (isTextArea(composer)) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      valueSetter?.call(composer, text);
    } else {
      composer.textContent = text;
    }

    dispatchHostInputEvents(composer);
    await microtask();
  }

  findSendButton() {
    return sendButtonSelectors
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .find((element): element is HTMLElement => Boolean(element && isVisible(element) && !isDisabled(element))) || null;
  }

  subscribeToDraft(callback: (text: string) => void) {
    let composer = this.findComposer();
    let lastText = "";
    const onInput = () => {
      const text = this.getDraftText();
      if (text !== lastText) {
        lastText = text;
        callback(text);
      }
    };
    const attach = () => {
      const nextComposer = this.findComposer();
      if (nextComposer === composer) return;
      composer?.removeEventListener("input", onInput, true);
      composer?.removeEventListener("keyup", onInput, true);
      composer = nextComposer;
      composer?.addEventListener("input", onInput, true);
      composer?.addEventListener("keyup", onInput, true);
      onInput();
      console.info("[Accord Guard] adapter reattached");
    };

    composer?.addEventListener("input", onInput, true);
    composer?.addEventListener("keyup", onInput, true);
    onInput();

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      composer?.removeEventListener("input", onInput, true);
      composer?.removeEventListener("keyup", onInput, true);
    };
  }

  subscribeToSubmit(callback: (submission: SubmissionController) => void) {
    const onKeyDown = (event: KeyboardEvent) => {
      const composer = this.findComposer();
      if (!composer || event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!composer.contains(event.target as Node)) return;

      callback({
        source: "keyboard",
        prevent: () => stopSubmission(event)
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const sendButton = this.findSendButton();
      if (!target || !sendButton || !sendButton.contains(target)) return;

      callback({
        source: "button",
        prevent: () => stopSubmission(event)
      });
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }

  subscribeToAssistantResponses(callback: (response: SurfaceAssistantResponse) => void) {
    const seenText = new WeakMap<HTMLElement, string>();
    const timers = new WeakMap<HTMLElement, number>();

    const scan = () => {
      for (const element of getAssistantElements()) {
        const text = element.innerText || element.textContent || "";
        if (!text.includes("[") || text === seenText.get(element)) continue;
        seenText.set(element, text);

        const existing = timers.get(element);
        if (existing) window.clearTimeout(existing);

        const timer = window.setTimeout(() => {
          callback({
            id: element.getAttribute("data-message-id") || stableElementId(element),
            element,
            text
          });
        }, 500);
        timers.set(element, timer);
      }
    };

    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    scan();

    return () => observer.disconnect();
  }

  subscribeToRouteChanges(callback: () => void) {
    const interval = window.setInterval(() => {
      if (location.href !== this.lastRoute) {
        this.lastRoute = location.href;
        callback();
      }
    }, 750);

    window.addEventListener("popstate", callback);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("popstate", callback);
    };
  }

  getConversationKey() {
    const match = location.pathname.match(/\/c\/([^/?#]+)/);
    if (match?.[1]) return `conversation:${match[1]}`;

    const storageKey = "accord.guard.chatgpt.draftKey";
    let draftKey = sessionStorage.getItem(storageKey);
    if (!draftKey) {
      draftKey = `draft:${crypto.randomUUID()}`;
      sessionStorage.setItem(storageKey, draftKey);
    }
    return draftKey;
  }

  async submit() {
    const button = this.findSendButton();
    if (!button) throw new Error("ChatGPT send button unavailable.");
    button.click();
    await microtask();
  }

  setComposerDecoratedState(state: ComposerDecorationState) {
    const composer = this.findComposer();
    if (!composer) return;
    composer.classList.add(decorationClass);
    composer.setAttribute("data-accord-guard-state", state);
  }

  hasAttachments() {
    return attachmentSelectors.some((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element || !isVisible(element)) return false;
      return !this.findComposer()?.contains(element);
    });
  }
}

function getAssistantElements() {
  const elements = assistantSelectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)));
  return Array.from(new Set(elements)).filter(isVisible);
}

function dispatchHostInputEvents(element: HTMLElement) {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function stopSubmission(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function isTextArea(element: HTMLElement): element is HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement;
}

function isDisabled(element: HTMLElement) {
  return element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
}

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function normalizeComposerText(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function microtask() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function stableElementId(element: HTMLElement) {
  const existing = element.dataset.accordGuardResponseId;
  if (existing) return existing;
  const id = crypto.randomUUID();
  element.dataset.accordGuardResponseId = id;
  return id;
}
