import type {
  AISurfaceAdapter,
  ComposerDecorationState,
  ComposerEntityDecoration,
  SubmissionController,
  SurfaceAssistantResponse
} from "./types";

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
  "[data-testid*='attachment-preview']",
  "[data-testid*='composer-attachment']",
  "[data-testid*='file-preview']",
  "[data-testid*='uploaded-file']",
  "[data-testid*='upload-preview']"
];

export class ChatGPTAdapter implements AISurfaceAdapter {
  readonly surface = "chatgpt" as const;
  private lastComposer: HTMLElement | null = null;
  private lastRoute = location.href;
  private highlightLayer: HTMLElement | null = null;
  private lastDecorations: ComposerEntityDecoration[] = [];
  private lastDecorationState: ComposerDecorationState = "clear";
  private lastDecorationDraft = "";

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
    this.lastDecorationState = state;
  }

  positionGuardRoot(root: HTMLElement) {
    const composer = this.findComposer();
    if (!composer) {
      root.dataset.attached = "false";
      return;
    }

    const composerRect = composer.getBoundingClientRect();
    const shellRect = findComposerShell(composer)?.getBoundingClientRect() || composerRect;
    const left = clamp(shellRect.left + 12, 10, window.innerWidth - 90);
    const top = clamp(Math.min(composerRect.top, shellRect.top) - 34, 10, window.innerHeight - 48);

    root.dataset.attached = "true";
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    this.drawStoredEntityDecorations();
  }

  setEntityDecorations(decorations: ComposerEntityDecoration[], state: ComposerDecorationState, draftText: string) {
    this.lastDecorations = decorations
      .filter((decoration) => decoration.start >= 0 && decoration.end > decoration.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    this.lastDecorationState = state;
    this.lastDecorationDraft = draftText;
    this.drawStoredEntityDecorations();
  }

  clearEntityDecorations() {
    this.lastDecorations = [];
    this.lastDecorationDraft = "";
    this.highlightLayer?.replaceChildren();
  }

  private drawStoredEntityDecorations() {
    if (!this.lastDecorations.length || !this.lastDecorationDraft) {
      this.highlightLayer?.replaceChildren();
      return;
    }

    const composer = this.findComposer();
    if (!composer) {
      this.highlightLayer?.replaceChildren();
      return;
    }

    const layer = this.ensureHighlightLayer();
    layer.replaceChildren();

    if (isTextArea(composer)) {
      drawTextareaDecorations(layer, composer, this.lastDecorations, this.lastDecorationState, this.lastDecorationDraft);
      return;
    }

    drawContentEditableDecorations(layer, composer, this.lastDecorations, this.lastDecorationState, this.lastDecorationDraft);
  }

  private ensureHighlightLayer() {
    if (this.highlightLayer?.isConnected) return this.highlightLayer;

    const existing = document.querySelector<HTMLElement>(".accord-guard-highlight-layer");
    if (existing) {
      this.highlightLayer = existing;
      return existing;
    }

    const layer = document.createElement("div");
    layer.className = "accord-guard-highlight-layer";
    layer.setAttribute("aria-hidden", "true");
    document.documentElement.append(layer);
    this.highlightLayer = layer;
    return layer;
  }

  hasAttachments() {
    return attachmentSelectors.some((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element || !isVisible(element)) return false;
      return !this.findComposer()?.contains(element);
    });
  }
}

type TextSegment = {
  node: Text;
  start: number;
  end: number;
};

type MappedDecoration = {
  decoration: ComposerEntityDecoration;
  start: number;
  end: number;
};

function drawContentEditableDecorations(
  layer: HTMLElement,
  composer: HTMLElement,
  decorations: ComposerEntityDecoration[],
  state: ComposerDecorationState,
  draftText: string
) {
  const segments = collectTextSegments(composer);
  const sourceText = segments.map((segment) => segment.node.data.replace(/\u00a0/g, " ")).join("");

  if (!segments.length || !sourceText.trim()) return;

  for (const mapped of mapDecorationsToSource(sourceText, draftText, decorations)) {
    const range = rangeFromOffsets(segments, mapped.start, mapped.end);
    if (!range) continue;
    paintRange(layer, range, mapped.decoration, state);
    range.detach();
  }
}

function drawTextareaDecorations(
  layer: HTMLElement,
  textarea: HTMLTextAreaElement,
  decorations: ComposerEntityDecoration[],
  state: ComposerDecorationState,
  draftText: string
) {
  const rect = textarea.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const mirror = document.createElement("div");
  const spans: HTMLElement[] = [];
  mirror.className = "accord-guard-textarea-mirror";
  copyTextareaLayout(textarea, mirror, rect);

  let cursor = 0;
  for (const decoration of decorations) {
    if (decoration.start < cursor || decoration.end > draftText.length) continue;
    mirror.append(document.createTextNode(draftText.slice(cursor, decoration.start)));

    const span = document.createElement("span");
    span.dataset.accordGuardType = decoration.type;
    span.dataset.accordGuardBlocked = String(isBlockedDecoration(decoration, state));
    span.textContent = draftText.slice(decoration.start, decoration.end) || " ";
    mirror.append(span);
    spans.push(span);
    cursor = decoration.end;
  }

  mirror.append(document.createTextNode(draftText.slice(cursor) || " "));
  layer.append(mirror);

  for (const span of spans) {
    for (const spanRect of Array.from(span.getClientRects())) {
      const clipped = intersectRects(spanRect, rect);
      if (clipped) paintClientRect(layer, clipped, span.dataset.accordGuardBlocked === "true");
    }
  }

  mirror.remove();
}

function collectTextSegments(root: HTMLElement) {
  const segments: TextSegment[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const length = node.data.length;
    if (!length) continue;

    segments.push({
      node,
      start: offset,
      end: offset + length
    });
    offset += length;
  }

  return segments;
}

function mapDecorationsToSource(sourceText: string, draftText: string, decorations: ComposerEntityDecoration[]) {
  const mapped: MappedDecoration[] = [];
  let cursor = 0;

  for (const decoration of decorations) {
    const target = draftText.slice(decoration.start, decoration.end).replace(/\u00a0/g, " ");
    if (!target.trim()) continue;

    const exactStart =
      sourceText.slice(decoration.start, decoration.end) === target && decoration.end <= sourceText.length ? decoration.start : -1;
    const nearStart = Math.max(0, Math.min(sourceText.length, decoration.start - 80));
    const afterCursorStart = sourceText.indexOf(target, Math.max(cursor, nearStart));
    const nearMatchStart = sourceText.indexOf(target, nearStart);
    const anyMatchStart = sourceText.indexOf(target);
    const start = [exactStart, afterCursorStart, nearMatchStart, anyMatchStart].find((value) => value >= 0) ?? -1;

    if (start < 0) continue;

    cursor = start + target.length;
    mapped.push({
      decoration,
      start,
      end: start + target.length
    });
  }

  return mapped;
}

function rangeFromOffsets(segments: TextSegment[], start: number, end: number) {
  const startPoint = pointFromOffset(segments, start);
  const endPoint = pointFromOffset(segments, end);
  if (!startPoint || !endPoint) return null;

  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  return range;
}

function pointFromOffset(segments: TextSegment[], offset: number) {
  for (const segment of segments) {
    if (offset >= segment.start && offset <= segment.end) {
      return {
        node: segment.node,
        offset: clamp(offset - segment.start, 0, segment.node.data.length)
      };
    }
  }

  return null;
}

function paintRange(layer: HTMLElement, range: Range, decoration: ComposerEntityDecoration, state: ComposerDecorationState) {
  const blocked = isBlockedDecoration(decoration, state);

  for (const rect of Array.from(range.getClientRects())) {
    paintClientRect(layer, rect, blocked);
  }
}

function paintClientRect(layer: HTMLElement, rect: DOMRect | { left: number; top: number; width: number; height: number }, blocked: boolean) {
  if (rect.width <= 1 || rect.height <= 4) return;

  const marker = document.createElement("div");
  marker.className = `accord-guard-entity-highlight${blocked ? " accord-guard-entity-highlight-blocked" : ""}`;
  marker.style.left = `${rect.left}px`;
  marker.style.top = `${rect.top}px`;
  marker.style.width = `${rect.width}px`;
  marker.style.height = `${rect.height}px`;
  layer.append(marker);
}

function copyTextareaLayout(textarea: HTMLTextAreaElement, mirror: HTMLElement, rect: DOMRect) {
  const style = getComputedStyle(textarea);

  Object.assign(mirror.style, {
    borderStyle: style.borderStyle,
    borderWidth: style.borderWidth,
    boxSizing: style.boxSizing,
    font: style.font,
    height: "auto",
    left: `${rect.left}px`,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    minHeight: `${rect.height + textarea.scrollTop}px`,
    opacity: "0",
    overflowWrap: "break-word",
    padding: style.padding,
    position: "fixed",
    tabSize: style.tabSize,
    top: `${rect.top - textarea.scrollTop}px`,
    whiteSpace: "pre-wrap",
    width: `${rect.width}px`
  });
}

function intersectRects(first: DOMRect, second: DOMRect) {
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(first.right, second.right);
  const bottom = Math.min(first.bottom, second.bottom);

  if (right <= left || bottom <= top) return null;

  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  };
}

function isBlockedDecoration(decoration: ComposerEntityDecoration, state: ComposerDecorationState) {
  return state === "blocked" || decoration.type === "SECRET";
}

function findComposerShell(composer: HTMLElement) {
  return (
    composer.closest<HTMLElement>("form") ||
    composer.closest<HTMLElement>("[data-testid*='composer']") ||
    composer.closest<HTMLElement>("[class*='composer']") ||
    composer.parentElement
  );
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
