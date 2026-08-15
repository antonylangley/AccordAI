import type { RehydrateSafeResult } from "../messaging/types";

const placeholderPattern = /\[(?:PERSON|EMAIL|PHONE|ADDRESS|ACCOUNT|SECRET|OTHER)_\d+\]/;
const skippedTags = new Set(["CODE", "PRE", "KBD", "SAMP", "TEXTAREA"]);
const blockSelector = "p, li, blockquote, h1, h2, h3, h4, h5, h6";
const responseViews = new WeakMap<HTMLElement, HTMLElement>();

type AccordResponseView = HTMLElement & {
  __accordCleanup?: () => void;
};

export type RenderResolvedResponseOptions = {
  markUrl: string;
  copyText?: (text: string) => Promise<void> | void;
};

export async function renderResolvedAssistantResponse(
  root: HTMLElement,
  responseId: string,
  rehydrate: (text: string) => Promise<RehydrateSafeResult>,
  options: RenderResolvedResponseOptions
) {
  if (!root.isConnected) {
    removeResolvedResponse(root);
    return null;
  }

  const originalText = getReadableText(root);
  const clone = root.cloneNode(true) as HTMLElement;
  sanitizeClone(clone);

  const textNodes = collectTextNodes(clone);
  let resolvedCount = 0;
  const unresolvedPlaceholders = new Set<string>();

  for (const node of textNodes) {
    const original = node.nodeValue || "";
    if (!placeholderPattern.test(original)) continue;

    const result = await rehydrate(original);
    if (result.resolvedCount <= 0) {
      result.unresolvedPlaceholders.forEach((placeholder) => unresolvedPlaceholders.add(placeholder));
      continue;
    }

    resolvedCount += result.resolvedCount;
    result.unresolvedPlaceholders.forEach((placeholder) => unresolvedPlaceholders.add(placeholder));
    node.replaceWith(renderResolvedText(result));
  }

  if (resolvedCount <= 0) {
    removeResolvedResponse(root);
    return null;
  }

  const view = upsertResolvedView(root, responseId);
  const mode = view.dataset.accordResponseMode === "original" ? "original" : "resolved";
  const fullResolvedText = getReadableText(clone);
  enhanceCopyableBlocks(clone, options.copyText);
  view.replaceChildren(
    buildResolvedOverlay({
      root,
      clone,
      view,
      markUrl: options.markUrl,
      originalText,
      fullResolvedText,
      resolvedCount,
      unresolvedCount: unresolvedPlaceholders.size,
      copyText: options.copyText
    })
  );
  setResponseMode(root, view, mode);
  positionResolvedView(root, view);

  return {
    view,
    originalText,
    resolvedText: fullResolvedText,
    resolvedCount,
    unresolvedPlaceholders: Array.from(unresolvedPlaceholders)
  };
}

export function removeResolvedResponse(root: HTMLElement) {
  const existing = responseViews.get(root);
  root.classList.remove("accord-guard-response-source-hidden");
  if (existing) {
    (existing as AccordResponseView).__accordCleanup?.();
    existing.remove();
    responseViews.delete(root);
  }
}

function renderResolvedText(result: RehydrateSafeResult) {
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const replacement of result.replacements) {
    if (replacement.start < cursor || replacement.end > result.resolvedText.length) continue;

    fragment.append(document.createTextNode(result.resolvedText.slice(cursor, replacement.start)));

    const span = document.createElement("span");
    span.className = "accord-guard-restored-identifier";
    span.dataset.accordPlaceholder = replacement.placeholder;
    span.dataset.accordEntityType = replacement.type;
    span.textContent = result.resolvedText.slice(replacement.start, replacement.end);
    fragment.append(span);

    cursor = replacement.end;
  }

  fragment.append(document.createTextNode(result.resolvedText.slice(cursor)));
  return fragment;
}

function buildResolvedOverlay({
  root,
  clone,
  view,
  markUrl,
  originalText,
  fullResolvedText,
  resolvedCount,
  unresolvedCount,
  copyText
}: {
  root: HTMLElement;
  clone: HTMLElement;
  view: HTMLElement;
  markUrl: string;
  originalText: string;
  fullResolvedText: string;
  resolvedCount: number;
  unresolvedCount: number;
  copyText?: (text: string) => Promise<void> | void;
}) {
  const overlay = document.createElement("div");
  overlay.className = "accord-guard-response-layer";

  const markButton = document.createElement("button");
  markButton.type = "button";
  markButton.className = "accord-guard-response-mark-button";
  markButton.setAttribute("aria-label", "Accord Guard response details");

  const mark = document.createElement("img");
  mark.src = markUrl;
  mark.alt = "";
  mark.className = "accord-guard-response-mark";
  const popover = buildResponsePopover(root, view, originalText, fullResolvedText, resolvedCount, unresolvedCount, copyText);
  markButton.append(mark, popover);
  wireResponsePopoverHover(markButton, popover);

  const content = document.createElement("div");
  content.className = "accord-guard-response-content";
  content.append(clone);

  overlay.append(markButton, content);
  return overlay;
}

function buildResponsePopover(
  root: HTMLElement,
  view: HTMLElement,
  originalText: string,
  fullResolvedText: string,
  resolvedCount: number,
  unresolvedCount: number,
  copyText?: (text: string) => Promise<void> | void
) {
  const popover = document.createElement("span");
  popover.className = "accord-guard-response-popover";

  const title = document.createElement("strong");
  title.textContent = "Accord Guard";

  const status = document.createElement("span");
  status.textContent = "Response resolved locally";

  const count = document.createElement("span");
  count.textContent = `${resolvedCount} protected identifier${resolvedCount === 1 ? "" : "s"} restored.`;

  const boundary = document.createElement("span");
  boundary.textContent = "ChatGPT received protected placeholders.";

  const controls = document.createElement("span");
  controls.className = "accord-guard-response-popover-controls";

  const resolvedToggle = document.createElement("button");
  resolvedToggle.type = "button";
  resolvedToggle.textContent = "Resolved";
  resolvedToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setResponseMode(root, view, "resolved");
  });

  const originalToggle = document.createElement("button");
  originalToggle.type = "button";
  originalToggle.textContent = "Protected original";
  originalToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setResponseMode(root, view, "original");
  });

  const copyFull = document.createElement("button");
  copyFull.type = "button";
  copyFull.textContent = "Copy full resolved response";
  copyFull.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void copyTextValue(fullResolvedText, copyText).then(() => {
      copyFull.textContent = "Copied";
      window.setTimeout(() => {
        copyFull.textContent = "Copy full resolved response";
      }, 1400);
    });
  });

  controls.append(resolvedToggle, originalToggle, copyFull);
  popover.append(title, status, count, boundary);

  if (unresolvedCount > 0) {
    const unresolved = document.createElement("span");
    unresolved.textContent = `${unresolvedCount} placeholder${unresolvedCount === 1 ? "" : "s"} stayed protected.`;
    popover.append(unresolved);
  }

  popover.append(controls);

  const original = document.createElement("span");
  original.className = "accord-guard-response-original-preview";
  original.textContent = originalText;
  popover.append(original);

  return popover;
}

function enhanceCopyableBlocks(clone: HTMLElement, copyText?: (text: string) => Promise<void> | void) {
  for (const block of Array.from(clone.querySelectorAll<HTMLElement>(blockSelector))) {
    if (hasSkippedAncestor(block) || block.querySelector("pre, code, kbd, samp, textarea, [role='code']")) continue;

    const text = getReadableText(block);
    if (!isUsefulCopyBlock(text)) continue;

    block.classList.add("accord-guard-copyable-block");

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "accord-guard-block-copy";
    copyButton.setAttribute("aria-label", "Copy resolved block");
    copyButton.title = "Copy resolved block";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void copyTextValue(text, copyText).then(() => {
        copyButton.textContent = "Copied";
        copyButton.dataset.copied = "true";
        window.setTimeout(() => {
          copyButton.textContent = "Copy";
          copyButton.dataset.copied = "false";
        }, 1200);
      });
    });

    block.append(copyButton);
  }
}

function upsertResolvedView(root: HTMLElement, responseId: string) {
  const existing = responseViews.get(root);
  if (existing?.isConnected) return existing;

  const view = document.createElement("section") as AccordResponseView;
  view.className = "accord-guard-response-overlay";
  view.dataset.accordResponseViewFor = responseId;
  view.dataset.accordResponseMode = "resolved";
  root.insertAdjacentElement("afterend", view);
  attachAlignmentObservers(root, view);
  responseViews.set(root, view);
  return view;
}

function setResponseMode(root: HTMLElement, view: HTMLElement, mode: "resolved" | "original") {
  view.dataset.accordResponseMode = mode;
  if (mode === "resolved") {
    root.classList.add("accord-guard-response-source-hidden");
  } else {
    root.classList.remove("accord-guard-response-source-hidden");
  }
  positionResolvedView(root, view);
}

function positionResolvedView(root: HTMLElement, view: HTMLElement) {
  const parent = view.parentElement;
  if (!parent || !root.isConnected) return;

  const parentStyle = window.getComputedStyle(parent);
  if (parentStyle.position === "static") {
    parent.dataset.accordGuardPositioned = "true";
    parent.style.position = "relative";
  }

  const rootRect = root.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();

  view.style.left = `${rootRect.left - parentRect.left + parent.scrollLeft}px`;
  view.style.top = `${rootRect.top - parentRect.top + parent.scrollTop}px`;
  view.style.width = `${rootRect.width}px`;
  view.style.minHeight = `${rootRect.height}px`;
  syncResponsePopoverPlacement(view);
}

function attachAlignmentObservers(root: HTMLElement, view: AccordResponseView) {
  const sync = () => {
    if (!root.isConnected || !view.isConnected) {
      removeResolvedResponse(root);
      return;
    }
    positionResolvedView(root, view);
  };

  let resizeObserver: ResizeObserver | undefined;
  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(root);
  }

  window.addEventListener("resize", sync);
  window.addEventListener("scroll", sync, true);

  view.__accordCleanup = () => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", sync);
    window.removeEventListener("scroll", sync, true);
  };
}

function syncResponsePopoverPlacement(view: HTMLElement) {
  const button = view.querySelector<HTMLElement>(".accord-guard-response-mark-button");
  const popover = view.querySelector<HTMLElement>(".accord-guard-response-popover");
  if (!button || !popover) return;

  const buttonRect = button.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const estimatedWidth = popover.offsetWidth || 288;
  const estimatedHeight = popover.offsetHeight || 220;
  const margin = 12;

  // Space on the left excludes any fixed left sidebar, so "room" never counts the
  // area hidden behind ChatGPT's nav.
  const roomLeft = buttonRect.left - leftContentEdge();
  const roomRight = viewportWidth - buttonRect.right;

  // Prefer opening over the message column (right) — that area is always on-screen.
  // Only fall back to the left gutter when the right genuinely can't fit the popover.
  let placeX: "left" | "right";
  if (roomRight >= estimatedWidth + margin) {
    placeX = "right";
  } else if (roomLeft >= estimatedWidth + margin) {
    placeX = "left";
  } else {
    placeX = roomRight >= roomLeft ? "right" : "left";
  }

  const hasRoomAbove = buttonRect.top >= estimatedHeight + margin;

  button.dataset.popoverY = hasRoomAbove ? "above" : "below";
  button.dataset.popoverX = placeX;
}

// Right edge of a fixed/sticky left-docked sidebar (ChatGPT's nav), or 0 if none is present.
function leftContentEdge(): number {
  let edge = 0;
  const candidates = document.querySelectorAll<HTMLElement>("nav, aside");
  for (const element of Array.from(candidates)) {
    const style = window.getComputedStyle(element);
    if (style.position !== "fixed" && style.position !== "sticky") continue;
    const rect = element.getBoundingClientRect();
    const docksLeft = rect.left <= 1 && rect.width > 40 && rect.width < window.innerWidth * 0.5;
    const isTall = rect.height > window.innerHeight * 0.4;
    if (docksLeft && isTall) edge = Math.max(edge, rect.right);
  }
  return edge;
}

// Hover-intent so the popover stays open long enough to move the cursor across the
// gap and into it. A short close delay covers the gap; click and focus also open it.
function wireResponsePopoverHover(button: HTMLElement, popover: HTMLElement) {
  const CLOSE_DELAY_MS = 160;
  let closeTimer: number | undefined;

  const open = () => {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
    button.classList.add("accord-guard-response-open");
  };
  const scheduleClose = () => {
    if (closeTimer !== undefined) window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      button.classList.remove("accord-guard-response-open");
      closeTimer = undefined;
    }, CLOSE_DELAY_MS);
  };

  button.addEventListener("mouseenter", open);
  button.addEventListener("mouseleave", scheduleClose);
  popover.addEventListener("mouseenter", open);
  popover.addEventListener("mouseleave", scheduleClose);
  button.addEventListener("focusin", open);
  button.addEventListener("focusout", scheduleClose);
  button.addEventListener("click", (event) => {
    // Clicks on the inner controls stopPropagation; a click on the mark just opens.
    if (event.target === button || event.target instanceof HTMLImageElement) {
      event.preventDefault();
    }
    open();
  });
  button.addEventListener("keydown", (event) => {
    if (event.key === "Escape") button.classList.remove("accord-guard-response-open");
  });
}

async function copyTextValue(text: string, copyText?: (text: string) => Promise<void> | void) {
  if (copyText) {
    await copyText(text);
    return;
  }

  await navigator.clipboard.writeText(text);
}

function sanitizeClone(clone: HTMLElement) {
  clone.removeAttribute("id");
  clone.removeAttribute("data-message-author-role");
  clone.removeAttribute("data-testid");
  clone.removeAttribute("data-accord-guard-response-id");
  clone.classList.remove("accord-guard-response-source-hidden");
  clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  clone.querySelectorAll("[data-message-author-role], [data-testid]").forEach((element) => {
    element.removeAttribute("data-message-author-role");
    element.removeAttribute("data-testid");
  });
  clone.querySelectorAll(".accord-guard-response-overlay, .accord-guard-response-overlay *").forEach((element) => element.remove());
}

function collectTextNodes(root: HTMLElement) {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || hasSkippedAncestor(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  return nodes;
}

function hasSkippedAncestor(element: Element) {
  let current: Element | null = element;

  while (current) {
    if (skippedTags.has(current.tagName) || current.getAttribute("role") === "code") return true;
    current = current.parentElement;
  }

  return false;
}

function getReadableText(element: HTMLElement) {
  const text = "innerText" in element && typeof element.innerText === "string" ? element.innerText : element.textContent || "";
  return normalizeWhitespace(text);
}

function normalizeWhitespace(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isUsefulCopyBlock(text: string) {
  if (text.length < 12) return false;
  return /[.!?]$/.test(text) || text.length >= 32;
}
