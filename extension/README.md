# Accord Guard

Accord Guard is the employee-facing browser-mode surface for Accord. It adds a compact governance layer inside ChatGPT so employees can keep using `https://chatgpt.com` while Accord scans typed prompts, redacts detected identifiers before governed submission, blocks credentials or prompt-injection attempts, and visually rehydrates trusted placeholders in assistant responses.

## Architecture

ChatGPT page -> Accord content script -> typed extension messaging -> MV3 background service worker -> `@accord/governance-core` scanner -> safe scan result with entity offsets -> inline Accord UI.

The existing Accord Workspace web app still owns provider requests inside the admin/control-plane product. Accord Guard does not call OpenAI, Anthropic, Gemini, or private ChatGPT APIs. It only reads and writes the supported ChatGPT page DOM.

## Privacy Boundary

Browser mode scans text typed into the existing ChatGPT composer, so the raw draft exists in the ChatGPT page DOM before Accord replaces it at final submission.

Supported claim: detected identifiers are removed before governed message submission.

Do not claim: the provider can never access raw draft text.

Sensitive placeholder mappings live only in `chrome.storage.session` in the extension service worker. They are not returned to the content script as a map, not sent to Accord backend services, not logged, and not stored in `chrome.storage.local` or `chrome.storage.sync`.

The content script receives only local decoration metadata for the current draft: entity type, start offset, end offset, and placeholder. It derives any employee-visible tooltip text from the already-visible composer draft and does not receive the complete `RedactionMap`.

## Known Limitations

- ChatGPT only. Claude support is intentionally not part of this milestone.
- Typed text only. File uploads, images, screenshots, and voice input are not governed in browser mode yet.
- Session-scoped placeholder vaults are lost after browser restart, extension reload, or service-worker/session reset.
- ChatGPT DOM selectors may need updates if ChatGPT changes its composer or response markup.
- This build has not been live-verified against the current ChatGPT production DOM from this coding environment.

## Supported Site

- `https://chatgpt.com/*`

## Chrome Permissions

- `storage`: stores session-only placeholder vaults in `chrome.storage.session`.
- `host_permissions: https://chatgpt.com/*`: injects the content script only on ChatGPT.

No `<all_urls>` permission is requested.

## Install Dependencies

From the repository root:

```powershell
pnpm install
```

## Development Command

From the repository root:

```powershell
pnpm guard:dev
```

Or from `extension/`:

```powershell
pnpm dev
```

## Production Build Command

From the repository root:

```powershell
pnpm guard:build
```

Or from `extension/`:

```powershell
pnpm build
```

## Built Directory

WXT writes the Chrome MV3 build here:

```text
C:\Users\anton\Documents\Codex\2026-07-01\files-mentioned-by-the-user-you\outputs\accord\extension\.output\chrome-mv3
```

This is the exact directory to select in Chrome:

```text
chrome://extensions -> Developer mode -> Load unpacked -> C:\Users\anton\Documents\Codex\2026-07-01\files-mentioned-by-the-user-you\outputs\accord\extension\.output\chrome-mv3
```

## Reload After Code Changes

1. Run `pnpm guard:build`.
2. Open `chrome://extensions`.
3. Find Accord Guard.
4. Click the reload button.
5. Refresh the ChatGPT tab.

For active development, run `pnpm guard:dev` and follow WXT's local dev output.

## Inspect Content-Script Errors

1. Open `https://chatgpt.com`.
2. Right-click the page and choose Inspect.
3. Open the Console tab.
4. Filter for `[Accord Guard]`.

Expected non-sensitive diagnostics include:

- `[Accord Guard] adapter attached`
- `[Accord Guard] ChatGPT composer located`
- `[Accord Guard] adapter reattached`
- `[Accord Guard] composer unavailable`

Draft contents are never logged.

## Inspect the Service Worker

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Find Accord Guard.
4. Click `service worker` under Inspect views.
5. Use the Console/Application tabs to inspect non-sensitive service-worker behavior.

## ChatGPT Selector Troubleshooting

All ChatGPT-specific selectors live in:

```text
extension/src/adapters/chatgpt.ts
```

Current composer assumptions:

- `#prompt-textarea`
- `textarea[data-testid='prompt-textarea']`
- `textarea[placeholder*='Message']`
- `div.ProseMirror[contenteditable='true']`
- `[contenteditable='true'][role='textbox']`
- `[contenteditable='true'][data-testid*='prompt']`

Current send-button assumptions:

- `button[data-testid='send-button']`
- `button[aria-label='Send prompt']`
- `button[aria-label='Send message']`
- `button:has(svg[aria-label='Send prompt'])`

Current assistant-response assumptions:

- `[data-message-author-role='assistant']`
- `article[data-testid*='conversation-turn'][data-message-author-role='assistant']`
- `[data-testid*='conversation-turn'] [data-message-author-role='assistant']`

If the indicator appears but messages are not intercepted, inspect the composer/send button and update only `chatgpt.ts`.

## First Test Prompts

1. Normal allow:

```text
Explain REST vs GraphQL.
```

Expected: quiet Accord active state, message sends normally.

2. Redaction:

```text
Draft an email to John Smith at john@gmail.com.
```

Expected: John Smith and john@gmail.com receive Accord violet inline highlighting, the compact emblem shows protected identifiers, and final submission replaces the draft with `[PERSON_1]` and `[EMAIL_1]` before sending.

3. Conversation-stable placeholder:

```text
Ask John Smith to review the new draft.
```

Expected: same conversation uses `[PERSON_1]` again.

4. Second person:

```text
Ask Mary Jones to review the new draft.
```

Expected: Mary Jones becomes `[PERSON_2]`.

5. Block:

```text
Use api_key=sk-1234567890abcdef to debug this.
```

Expected: the exact credential span receives stronger blocked highlighting, the compact emblem shows `Sending blocked`, and no submission occurs.

6. Response rehydration:

If ChatGPT responds with `[PERSON_1]`, the employee-visible DOM should show `John Smith`; the underlying ChatGPT conversation remains placeholder-based.
