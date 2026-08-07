# Accord Audit Summary

Audit date: 2026-08-06

## What Accord Demonstrably Does Today

Accord has a working prototype of browser-side governance for ChatGPT. The extension reads draft prompts, scans them locally with deterministic detectors, redacts detected sensitive values, stores placeholder mappings in extension session storage, submits sanitized text to ChatGPT, and can rehydrate assistant responses locally. It also governs supported file uploads by extracting text locally and replacing risky originals with sanitized text files. Evidence: `extension/entrypoints/accord.content/index.tsx:107-247`, `extension/entrypoints/accord.content/index.tsx:306-371`, `extension/src/governance/scan-session.ts:41-120`.

Accord has a Supabase-backed dashboard and policy loop. Admins can upload a policy document, have the server extract text, generate deterministic candidate rules, save drafts, approve rules, publish bundles, and have the extension fetch the latest bundle. Evidence: `src/app/api/policies/import/route.ts:10-48`, `src/lib/policy-import/rule-inference.ts:48`, `src/lib/db/accord-store.ts:541-754`, `extension/src/policy/bundle-client.ts:15-43`.

Accord also has an in-app web chat gateway. That gateway receives the raw prompt server-side, scans/redacts it, sends redacted context to a selected provider, post-scans the response, and stores redacted previews/metadata. Evidence: `src/app/api/chat/route.ts:36-40`, `src/lib/chat/gateway.ts:37-129`, `src/lib/db/accord-store.ts:313-368`.

## What It Does Not Yet Do

- It does not have production-grade extension authentication or tenant binding. Extension telemetry and bundle fetch default to local/test company settings.
- It does not enforce robust role-based access in server actions or guard APIs.
- It does not use AI to parse uploaded policies into rules; current extraction is deterministic.
- It does not support multiple AI websites beyond ChatGPT in the extension.
- It does not provide complete retention, deletion, billing, user/team management, or override workflows.
- It does not guarantee every event is linked to a source policy clause.

## Do Raw Employee Prompts Leave the Browser?

For Accord Guard extension usage on ChatGPT: repository code indicates no raw prompt is sent to the Accord backend or model providers before redaction. The raw prompt is read from the ChatGPT DOM and passed to the extension background scanner. Redacted text is then submitted to ChatGPT. Caveat: raw text exists in the ChatGPT page DOM while the user types, and repository code cannot prove what the ChatGPT page itself observes.

For Accord web chat: yes. Raw prompts are sent from the browser to Accord's `/api/chat` route before server-side scanning.

## Does OpenAI or Another Model See Raw Prompts?

For the extension path: not by Accord code. ChatGPT receives the sanitized prompt after local redaction.

For the web chat path: the configured model provider receives the redacted prompt and sanitized history by current code. False negatives, image uploads, or future changes could still expose private content.

## Are Policy Documents Sent to an AI Provider?

No AI-provider call was found in the policy import flow. The uploaded document is sent to Accord's backend, read into memory, text-extracted, and parsed deterministically into candidate rules.

## Top Five Blockers Before the AMC Meeting

1. Clarify privacy claims by surface: extension local governance versus web chat server gateway.
2. Add or explain extension enrollment/tenant identity. Current defaults such as `test-company` are demo-like.
3. Protect guard telemetry and policy-bundle APIs with authentication or scoped tokens.
4. Avoid claiming AI-generated policy extraction; current extraction is deterministic.
5. Validate production Supabase migrations, RLS, and Vercel env/log behavior.

## Top Five Blockers Before a Real Pilot

1. Production auth, organization membership, and RBAC enforcement across dashboard and APIs.
2. Per-organization extension provisioning and signed/scoped policy bundle access.
3. Retention/deletion controls for events, users, policies, and local placeholder mappings.
4. Stronger policy extraction, human review, version lifecycle, and source-clause traceability.
5. Formal security/privacy review of extension permissions, message passing, storage, and platform logs.

## Confidence

High confidence for repository-level behavior. Medium confidence for deployed behavior because Supabase dashboard state, Vercel settings, provider retention policies, browser network traces, and production extension packaging require external inspection.

