# Accord Privacy Claims Audit

Audit date: 2026-08-06

Scope: read-only repository audit. This validates current code behavior, not intended roadmap claims.

## Privacy and Product Claim Validation

| Claim | Classification | Code-Supported Analysis |
|---|---|---|
| "Raw prompts and responses are not stored." | Supported with qualifications | Extension telemetry stores metadata, not raw prompts, by current client code. Web chat persistence stores `redacted_preview` and `raw_stored:false`. Evidence: `extension/src/telemetry/client.ts:18-35`, `src/lib/db/accord-store.ts:313-368`. Qualification: web chat raw prompts still reach the Accord backend request handler; Vercel/server logs are outside repo. Generic `metadata` columns could be misused later. |
| "Sensitive values stay local." | Supported with qualifications | Strongest for the ChatGPT extension path: raw prompt is scanned locally and placeholder mappings are stored in `chrome.storage.session`. Evidence: `extension/src/governance/scan-session.ts:41-56`, `extension/src/governance/placeholder-vault.ts:24-44`. Not true for Accord web chat, where raw prompt is posted to `/api/chat`, or admin policy upload, where the full policy file is posted to `/api/policies/import`. Evidence: `src/app/api/chat/route.ts:36-40`, `src/app/api/policies/import/route.ts:10-23`. |
| "Governance without conversation surveillance." | Supported with qualifications | Extension events are metadata-oriented, and dashboard records counts/flags rather than conversations. Evidence: `src/lib/db/accord-store.ts:440-469`. Qualification: web chat does process raw prompt server-side before redaction, and redacted previews are stored. There are no retention/deletion controls found. |
| "Accord records metadata, not conversation archives." | Supported with qualifications | Extension telemetry records risk, action, flags, counts, message length bucket, and rule metadata. Evidence: `extension/src/messaging/types.ts:73-93`, `src/lib/db/accord-store.ts:440-469`. Web chat stores redacted message previews and audit metadata, not raw messages by current code. Evidence: `src/lib/db/accord-store.ts:313-368`. Qualification: redacted previews are still message-derived data. |
| "Private information never reaches a third-party model." | Supported with qualifications, not absolute | For web chat, provider context is built from redacted prompt/history. Evidence: `src/lib/chat/context-builder.ts:47-54`, `src/lib/chat/context-builder.ts:106-114`. For extension, Accord submits redacted text to ChatGPT after local replacement. Qualification: detector false negatives, image uploads, and raw text existing in the ChatGPT DOM before submit can defeat the absolute wording. Repository code cannot prove what the ChatGPT page observes while the user types. |
| "Policy enforcement happens locally." | Supported with qualifications | True for extension scanning and policy evaluation in ChatGPT browser mode. Evidence: `extension/src/governance/scan-session.ts:41-56`, `extension/src/policy/bundle-client.ts:15-43`. Not true for Accord web chat, where enforcement occurs server-side in `runChatGateway`. Evidence: `src/lib/chat/gateway.ts:22-129`. |
| "Accord can enforce uploaded company policies." | Supported with qualifications | A policy file can be uploaded, parsed into proposed rules, approved, published, fetched by the extension, and evaluated locally. Evidence: `src/app/api/policies/import/route.ts:10-48`, `src/lib/db/accord-store.ts:665-754`, `extension/src/policy/bundle-client.ts:15-43`. Qualification: extraction is deterministic and limited; no AI semantic rule generation exists; extension tenant auth is weak/defaulted. |
| "Every event is linked to its source policy clause." | Not currently supported | Policy-triggered extension telemetry can include rule id, rule key, rule version, source policy name, and source section. Evidence: `extension/entrypoints/accord.content/index.tsx:598-615`. However scanner-only events and generic PII redactions are not necessarily linked to a stored source policy clause, and source excerpts are not attached to every event. |

## Exact Contradictions and Qualifications

### Raw prompt locality is true only for the extension path

The extension path is designed around local scanning. The content script reads the prompt, sends it to the extension background process, gets a safe result, replaces the draft, and then submits. Evidence: `extension/entrypoints/accord.content/index.tsx:173-247`.

The web chat path is different. It posts the raw prompt to Accord's server route. Evidence: `src/app/(app)/chat/chat-workspace.tsx:337-391`, `src/app/api/chat/route.ts:36-40`.

Recommended wording for internal demos should distinguish "Accord Guard browser mode" from "Accord web chat."

### Policy upload is not local

The admin policy upload flow sends the original policy file to the Accord backend and reads it into a server buffer. Evidence: `src/app/api/policies/import/route.ts:10-23`.

Current code does not send that policy document to an AI provider. It extracts text and infers rules server-side with deterministic code. Evidence: `src/app/api/policies/import/route.ts:40`, `src/lib/policy-import/rule-inference.ts:48`.

### Policy extraction is not AI-generated

The intended product loop says Accord extracts concrete requirements and proposes actionable rules. The implemented version does propose rules, but does so through deterministic patterns, not model reasoning. Evidence: `src/lib/policy-import/rule-inference.ts:48`.

### Rule distribution works but is not secure enough

The extension can fetch the latest published bundle. Evidence: `extension/src/policy/bundle-client.ts:15-43`.

The server endpoint accepts a `companySlug` query and has no visible authentication. Evidence: `src/app/api/guard/policy-bundle/route.ts:6-22`.

### Telemetry is metadata-oriented but unauthenticated

The extension telemetry client sends metadata, not raw prompt text. Evidence: `extension/src/telemetry/client.ts:18-35`.

The telemetry route has permissive CORS and no visible token validation. Evidence: `src/app/api/guard/telemetry/route.ts:6-23`.

## Critical Unknowns Requiring External Inspection

The repository cannot answer all privacy questions. The following evidence is required:

1. Supabase dashboard configuration
   - Actual RLS policies currently deployed.
   - Whether SQL migrations have been run in production.
   - Table contents for `metadata`, `redacted_preview`, and `bundle` columns.
   - Database backups and retention settings.

2. Vercel deployment configuration
   - Production environment variables and branch deployment settings.
   - Function log retention.
   - Whether request bodies can appear in logs or observability tools.
   - Whether source maps expose sensitive implementation details.

3. AI provider account settings
   - OpenAI/Anthropic/Gemini data retention and training settings.
   - Organization-level logging and abuse monitoring configuration.
   - Whether image uploads routed through web chat are retained by provider.

4. Browser network inspection
   - Confirm actual Chrome extension network requests during typing, paste, submit, file upload, and assistant response rehydration.
   - Confirm no unexpected request contains raw prompt/file content.

5. Built extension artifact review
   - Confirm production manifest permissions and content security policy.
   - Confirm no development localhost endpoints are shipped in production builds unless intentionally configurable.

6. Operational monitoring
   - Sentry, analytics, log drains, or browser console collection if added outside repository.

## Security and Demo Readiness

### Critical before showing AMC

- Explain the raw-prompt answer by surface. "Raw prompt stays local" is defensible for Accord Guard extension code, not for Accord web chat.
- Avoid showing unauthenticated tenant switching as production-ready. Extension telemetry and bundle fetch use default local company settings.
- Do not claim AI-generated policy extraction. Current policy extraction is deterministic.
- Do not claim complete source-clause traceability for every event.
- Validate production Supabase migrations and Vercel env vars before demo.

### Important before a pilot

- Add authenticated extension enrollment and per-organization tokens.
- Enforce role-based checks for policy authoring, publishing, and dashboard views.
- Add retention and deletion flows.
- Add explicit policy/document lifecycle controls.
- Audit platform/provider logs.

### Important before production

- Review extension message passing, host permissions, and storage threat model.
- Add cross-tenant tests.
- Add fail-open/fail-closed policy by rule type.
- Add false-positive and false-negative review flows.
- Add security review for generic metadata fields.

