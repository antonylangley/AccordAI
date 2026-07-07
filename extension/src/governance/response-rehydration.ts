const placeholderPattern = /\[(?:PERSON|EMAIL|PHONE|ADDRESS|ACCOUNT|SECRET|OTHER)_\d+\]/;
const skippedTags = new Set(["CODE", "PRE", "KBD", "SAMP", "TEXTAREA"]);

export async function rehydrateTextNodes(root: HTMLElement, rehydrate: (text: string) => Promise<string>) {
  const textNodes = collectTextNodes(root);

  for (const node of textNodes) {
    const original = node.nodeValue || "";
    if (!placeholderPattern.test(original)) continue;
    const rehydrated = await rehydrate(original);
    if (rehydrated !== original) {
      node.nodeValue = rehydrated;
    }
  }
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
