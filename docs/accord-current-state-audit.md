# Accord Current State Audit

Audit date: 2026-08-06

Scope: read-only repository inspection of the current working tree. Production source code, dependencies, environment variables, and database schemas were not modified.

Line references are based on the local repository state at audit time.

## Executive Summary

The most important privacy answer is surface-specific:

- In the Accord Guard Chrome extension path for ChatGPT, the raw employee prompt is read from the ChatGPT DOM and passed to the extension background scanner, but repository code does not send that raw prompt to the Accord backend or to OpenAI/Anthropic/Gemini before redaction. After redaction, the extension submits the redacted prompt to ChatGPT. Evidence: `extension/entrypoints/accord.content/index.tsx:173-233`, `extension/src/governance/scan-session.ts:41-56`, `extension/src/telemetry/client.ts:18-35`.
- In the Accord web chat path, the raw prompt does leave the browser and is posted to Accord's Next.js backend at `/api/chat`. The backend scans and redacts it before invoking the selected model provider. Evidence: `src/app/(app)/chat/chat-workspace.tsx:337-391`, `src/app/api/chat/route.ts:36-40`, `src/lib/chat/gateway.ts:37`, `src/lib/chat/context-builder.ts:47-54`.
- Policy documents uploaded in the admin UI are sent from the browser to the Accord backend. Current repository code extracts text deterministically and infers rules locally on the server; no AI model call is used for policy import. Evidence: `src/app/(app)/policies/policy-import-panel.tsx:36-40`, `src/app/api/policies/import/route.ts:10-48`, `src/lib/policy-import/rule-inference.ts:48`.
- The biggest technical risk before a serious demo is not redaction quality alone. It is tenant/auth hardening: the guard telemetry and policy bundle endpoints are not authenticated in code, and extension configuration defaults to `test-company`. Evidence: `src/app/api/guard/telemetry/route.ts:6-23`, `src/app/api/guard/policy-bundle/route.ts:6-22`, `extension/src/telemetry/client.ts:3-8`, `extension/src/policy/bundle-client.ts:3-20`.

Accord demonstrably has a meaningful local-governance prototype: ChatGPT prompt interception, local scanning/redaction, placeholder reinsertion, governed attachment replacement for supported file types, Supabase telemetry, admin policy authoring/publishing, and dashboard metrics. It is not yet a production multi-tenant compliance system.

## Repository Architecture

| Component | Purpose | Technology | Entry Point | Important Files | Dependencies | Current Status |
|---|---|---|---|---|---|---|
| Web app / dashboard | Landing page, admin dashboard, policy authoring, web chat prototype | Next.js App Router, React, Tailwind | `src/app/layout.tsx`, `src/app/page.tsx` | `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/policies/page.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/top-nav.tsx` | `next`, `react`, `lucide-react`, `recharts`, `geist` | Working with limitations |
| Accord Chat web route | Server-side governed chat gateway for the in-app chat page | Next.js route handler | `src/app/api/chat/route.ts` | `src/lib/chat/gateway.ts`, `src/lib/chat/context-builder.ts`, `src/lib/chat/providers/*` | Native `fetch`, provider env vars | Working with limitations |
| Attachment API for web chat | Accepts uploaded files from Accord web chat | Next.js route handler | `src/app/api/attachments/route.ts` | `src/lib/chat/attachments.ts` | Node buffers, parser utilities | Partial; browser uploads file to Accord backend |
| Policy import API | Upload written policy and infer candidate rules | Next.js route handler | `src/app/api/policies/import/route.ts` | `src/lib/policy-import/document-text.ts`, `src/lib/policy-import/rule-inference.ts` | Built-in parsing; no model SDK | Working with limitations |
| Policy draft import API | Saves selected imported rules as drafts | Next.js route handler | `src/app/api/policies/import/drafts/route.ts` | `src/lib/db/accord-store.ts` | Supabase service role | Working with limitations |
| Guard telemetry API | Receives extension metadata events | Next.js route handler | `src/app/api/guard/telemetry/route.ts` | `src/lib/db/accord-store.ts` | Supabase service role | Working, but unauthenticated |
| Guard policy bundle API | Serves latest published policy bundle to extension | Next.js route handler | `src/app/api/guard/policy-bundle/route.ts` | `src/lib/db/accord-store.ts` | Supabase service role | Working, but unauthenticated |
| Supabase data adapter | Reads/writes dashboard, chat, policy, telemetry state | Supabase JS | `src/lib/db/accord-store.ts` | `supabase/migrations/*.sql` | `@supabase/supabase-js`, `@supabase/ssr` | Working with limitations |
| Authentication | Supabase OAuth login/callback/logout and default organization creation | Supabase Auth, Next middleware | `src/middleware.ts`, `src/app/auth/*/route.ts` | `src/lib/auth/organization.ts`, `src/app/login/page.tsx` | `@supabase/ssr` | Partially implemented |
| Browser extension | Intercepts ChatGPT prompts/files, scans/redacts locally, rehydrates responses | WXT, Chrome MV3, React content UI | `extension/wxt.config.ts`, `extension/entrypoints/accord.content/index.tsx`, `extension/entrypoints/background.ts` | `extension/src/governance/*`, `extension/src/adapters/*`, `extension/src/telemetry/client.ts` | `wxt`, `@accord/governance-core`, Chrome APIs | Working prototype |
| Shared governance core | Deterministic scanning, redaction, policy decisions, rehydration helpers | TypeScript package | `packages/governance-core/src/index.ts` | `packages/governance-core/src/scanner.ts`, `packages/governance-core/src/types.ts` | TypeScript | Working with fixture tests |
| Policy evaluator | Applies published rules in extension | TypeScript | `extension/src/policy/evaluator.ts` | `extension/src/policy/bundle-client.ts`, `extension/src/policy/types.ts` | Chrome storage, fetch | Working with limitations |
| Charts / UI | Dashboard visualization | React components | `src/components/charts/*.tsx` | `usage-line-chart.tsx`, `risk-distribution-chart.tsx`, `risk-category-bars.tsx` | `recharts` | Working with limited data |
| Contact page | Demo/contact request page | Next.js route and client form | `src/app/contact/page.tsx` | `src/app/contact/contact-form.tsx` | None visible for email delivery | UI/local behavior only unless form storage exists elsewhere |
| Deployment | Vercel-compatible Next.js app | Next.js build | `next.config.mjs`, `package.json` | `pnpm-lock.yaml`, `vercel` project settings outside repo | Vercel inferred from deployment context | Build passes locally |

## Applications and Packages

- Root Next.js application: `package.json`, `src/app/*`.
- Browser extension: `extension/package.json`, `extension/wxt.config.ts`.
- Shared governance package: `packages/governance-core`.
- Workspace configuration: `pnpm-workspace.yaml`.

## Frontend Framework

The frontend is Next.js App Router with React and Tailwind:

- Root layout: `src/app/layout.tsx`.
- App routes under `src/app`.
- Dashboard routes grouped under `src/app/(app)`.
- Styling in `src/app/globals.css` and Tailwind config in `tailwind.config.ts`.

## Browser Extension Architecture

The extension is WXT-based Chrome MV3:

- Manifest source: `extension/wxt.config.ts`.
- Content entrypoint: `extension/entrypoints/accord.content/index.tsx`.
- Background service worker: `extension/entrypoints/background.ts`.
- Content script match: `https://chatgpt.com/*` in `extension/entrypoints/accord.content/index.tsx:20-23`.
- Manifest permissions: `storage` in `extension/wxt.config.ts:14`.
- Host permissions: `https://chatgpt.com/*`, `http://127.0.0.1:3000/*`, and `http://localhost:3000/*` in `extension/wxt.config.ts:15`.

The extension currently focuses on ChatGPT. It uses a content script to read the draft, send scans to the background script, replace the composer with redacted text, govern attachments, and rehydrate assistant responses locally.

## Backend / Server Framework

Backend behavior is implemented as Next.js route handlers and server-side utility modules:

- Chat: `src/app/api/chat/route.ts`.
- Attachments: `src/app/api/attachments/route.ts`.
- Policy import: `src/app/api/policies/import/route.ts`.
- Imported policy drafts: `src/app/api/policies/import/drafts/route.ts`.
- Guard telemetry: `src/app/api/guard/telemetry/route.ts`.
- Guard bundle: `src/app/api/guard/policy-bundle/route.ts`.

## Database and Authentication Providers

Supabase is the database and authentication provider:

- Server client: `src/lib/auth/supabase-server.ts`.
- Middleware session refresh: `src/middleware.ts`.
- Organization resolution: `src/lib/auth/organization.ts`.
- Database adapter: `src/lib/db/accord-store.ts`.
- Migrations: `supabase/migrations/20260727143000_create_accord_governance_store.sql`, `supabase/migrations/20260727152000_create_extension_telemetry.sql`, `supabase/migrations/20260728100000_create_policy_enforcement_loop.sql`, `supabase/migrations/20260803120000_add_auth_organizations.sql`.

Authentication is present but not yet consistently enforced across dashboard data access and guard APIs.

## AI Providers and SDKs

Model provider adapters use direct HTTP `fetch`, not an installed OpenAI/Anthropic/Gemini SDK:

- Registry: `src/lib/chat/model-registry.ts:21-58`.
- Provider selection: `src/lib/chat/providers/index.ts:18-34`.
- OpenAI: `src/lib/chat/providers/openai-provider.ts:42-60`.
- Anthropic: `src/lib/chat/providers/anthropic-provider.ts:39-60`.
- Gemini: `src/lib/chat/providers/gemini-provider.ts:39-59`.

Configured/fallback model names in code:

- OpenAI: registry entries `gpt-4.1` and `gpt-4.1-mini`; env override `OPENAI_MODEL`.
- Anthropic: registry entry `claude-sonnet-4-5`; env override `ANTHROPIC_MODEL`.
- Gemini: registry entry `gemini-2.5-pro`; env override `GEMINI_MODEL`.
- Default requested model: `"GPT-4.1"` in `src/lib/chat/gateway.ts:195`.

The policy document import flow does not currently call an AI model. It uses deterministic rule inference in `src/lib/policy-import/rule-inference.ts:48`.

## Logging, Analytics, Telemetry, Monitoring

Confirmed:

- Extension telemetry posts metadata to `/api/guard/telemetry`: `extension/src/telemetry/client.ts:18-35`.
- Server persists extension events in `accord_extension_events`: `src/lib/db/accord-store.ts:389-469`.
- Chat gateway persists redacted chat/governance/audit records: `src/lib/db/accord-store.ts:290-386`.
- Extension uses console logging for non-raw diagnostics in several files, including attachment support and telemetry errors.

Not found in repository:

- Sentry or equivalent error reporting.
- PostHog or other analytics SDK.
- Queue, retry queue, or dead-letter queue infrastructure.
- Payment/billing integration.

Platform logs from Vercel/Supabase may still contain request metadata or error details, but that cannot be confirmed from repository code alone.

## Storage Providers

Confirmed:

- Supabase Postgres tables via migrations.
- Chrome extension storage:
  - `chrome.storage.local` for API base URL, company slug/name, user label, install ID, and cached policy bundles.
  - `chrome.storage.session` for placeholder vault mappings and recent draft fallback.

Not found:

- Supabase Storage bucket migrations.
- S3/GCS/Azure blob storage.
- Vercel Blob integration.

## Environment Variables

Environment variable names found in repo, without values:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`
- `GEMINI_MODEL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

Evidence includes `.env.local.example:1-12`, `src/lib/chat/providers/*.ts`, `src/middleware.ts:7-9`, and `src/lib/auth/supabase-server.ts:12-14`.

## Test Infrastructure

- Root lint/build scripts: `package.json`.
- Extension tests: `extension/package.json`, Vitest.
- Governance-core typecheck: `packages/governance-core`.
- Redaction/person evaluation scripts: `scripts/evaluate-redaction.cjs`, `scripts/evaluate-person-detection.cjs`.

## Current Product Capabilities

| Feature | Classification | Evidence |
|---|---|---|
| Landing page | Working with limitations | `src/app/page.tsx` |
| Contact/demo page | UI only / partially implemented | `src/app/contact/page.tsx`, `src/app/contact/contact-form.tsx`; no email service found |
| Authentication | Partially implemented | `src/app/auth/login/route.ts:9-27`, `src/app/auth/callback/route.ts:16-21`, `src/middleware.ts:15-28` |
| Organization creation | Working with limitations | `src/lib/auth/organization.ts:110-181` |
| User and team management | Partially implemented | Tables in `supabase/migrations/20260803120000_add_auth_organizations.sql:10-31`; no full UI found |
| Role-based access | Partially implemented | Role schema and RLS exist, but service-role app operations and weak route enforcement remain |
| Browser-extension installation | Working prototype | `extension/wxt.config.ts`, `extension/package.json` |
| Browser-extension authentication | Planned / not present | Extension defaults to company slug/user label in `extension/src/telemetry/client.ts:3-8`; no auth token |
| Supported AI websites | Working with limitations | ChatGPT only: `extension/entrypoints/accord.content/index.tsx:20-23` |
| Prompt interception | Working end-to-end for ChatGPT | `extension/entrypoints/accord.content/index.tsx:172-247` |
| Typing/paste live scan | Working with limitations | Debounced scan in `extension/entrypoints/accord.content/index.tsx:107-153` |
| Local sensitive-data detection | Working with limitations | `packages/governance-core/src/scanner.ts:392-456`, `:658-691`, `:964-979` |
| Local named-entity ML | Dead/unused or unavailable | Evaluation reported `personDetectorStatusCounts.unavailable`; no local model executed |
| Local redaction | Working | `packages/governance-core/src/scanner.ts:431-456` |
| Placeholder reinsertion | Working with limitations | `packages/governance-core/src/scanner.ts:561-572`, `extension/src/governance/scan-session.ts:101-120` |
| Warning behavior | Working with limitations | `packages/governance-core/src/scanner.ts:607-654`, extension UI logic in `extension/entrypoints/accord.content/index.tsx` |
| Blocking behavior | Working with limitations | `extension/entrypoints/accord.content/index.tsx:181-210`, `extension/src/governance/scan-session.ts:278-319` |
| Rewrite behavior | Partially implemented | Redacted replacement exists; no separate generative rewrite for extension prompt |
| User overrides | Planned / not present | No general override path found; blocked sends are prevented |
| File upload interception | Working with limitations | `extension/entrypoints/accord.content/index.tsx:306-371` |
| Local file text extraction | Working with limitations | `extension/entrypoints/accord.content/index.tsx:485-528`, `extension/src/attachments/extract-text.ts:26-48` |
| Policy upload | Working with limitations | `src/app/(app)/policies/policy-import-panel.tsx:27-40`, `src/app/api/policies/import/route.ts:10-48` |
| Policy parsing / clause extraction | Partially implemented | Deterministic extractor/inference: `src/lib/policy-import/document-text.ts`, `src/lib/policy-import/rule-inference.ts:48` |
| AI-generated policy rules | Not currently supported | Policy import route calls deterministic inference, not provider adapter |
| Admin rule review/edit | Working with limitations | `src/app/(app)/policies/page.tsx:113-161`, `src/lib/db/accord-store.ts:541-650` |
| Policy versioning | Working with limitations | `src/lib/db/accord-store.ts:541-754`, `supabase/migrations/20260728100000_create_policy_enforcement_loop.sql:69-99` |
| Policy publishing | Working with limitations | `src/lib/db/accord-store.ts:665-754` |
| Rule distribution to extension | Working with limitations | `src/app/api/guard/policy-bundle/route.ts:6-22`, `extension/src/policy/bundle-client.ts:15-43` |
| Department/role-specific rules | Partially implemented | Rule fields exist; extension context largely hardcoded/default |
| Event creation | Working with limitations | `src/lib/db/accord-store.ts:389-469` |
| Dashboard analytics | Working with limitations | `src/app/(app)/dashboard/page.tsx`, `src/lib/db/accord-store.ts` |
| Audit logs | Partially implemented | `accord_audit_events` migration and `persistChatGatewayRun` |
| Privacy controls | Partially implemented | Raw-store booleans and redacted previews exist; no full settings/deletion flow |
| Data deletion | Partial | Policy rule delete exists for archived rules: `src/lib/db/accord-store.ts:652-662`; no event/user retention delete flow found |
| Retention settings | Planned / not present | No retention setting enforcement found |
| Demo or test data | Present | `src/lib/mock-data.ts`, `src/lib/db/accord-store.ts:832-890`, migration seed data |
| Billing/subscriptions | Absent | No payment provider or billing tables found |
| Integrations | Partial | Supabase, OAuth, web-chat AI providers, ChatGPT extension |

## Website Claims vs Implementation

The website and UI correctly communicate parts of the product direction, but several claims need qualification:

- Browser-side guardrails are real for the ChatGPT extension path.
- Uploaded policy enforcement is partially real: a policy document can produce rules, and approved rules can be bundled and fetched by the extension. However, rule extraction is deterministic and limited, not AI-generated semantic extraction.
- "Metadata only" is strongest for extension telemetry. It is weaker for Accord web chat because raw prompts are posted to Accord's backend before redaction.
- "Every event linked to source policy clause" is not fully implemented; scanner-only events do not necessarily include a rule or source clause.

## AMC Demo-Readiness Findings

### Critical before showing AMC

1. Guard telemetry and policy-bundle APIs lack authentication or tenant validation in code.
   - `src/app/api/guard/telemetry/route.ts:6-23`
   - `src/app/api/guard/policy-bundle/route.ts:6-22`
   - `extension/src/telemetry/client.ts:3-8`

2. Product privacy answer must be carefully scoped by surface.
   - Extension path: raw prompt stays local by repository code.
   - Web chat path: raw prompt is posted to `/api/chat`.
   - Evidence: `src/app/(app)/chat/chat-workspace.tsx:337-391`, `src/app/api/chat/route.ts:36-40`.

3. Extension organization identity is default/demo-like.
   - Default company slug and user label exist in `extension/src/telemetry/client.ts:3-8`.
   - Policy bundle fetch defaults to `test-company` in `extension/src/policy/bundle-client.ts:18-20`.

4. RLS exists in migrations, but server-side service-role access bypasses it.
   - `src/lib/db/accord-store.ts:780-798`.

5. Policy import is not AI-semantic extraction.
   - `src/app/api/policies/import/route.ts:40` calls `inferPolicyRulesFromText`.
   - `src/lib/policy-import/rule-inference.ts:48`.

### Important before a pilot

- Add real extension authentication/tenant binding.
- Enforce role checks before policy authoring/publishing.
- Add explicit retention/deletion controls for events, users, policies, and mappings.
- Validate production Supabase RLS and Vercel log behavior outside the repository.
- Confirm provider data retention settings for any web chat provider use.
- Add robust policy version lifecycle and source-document deletion/version handling.

### Important before production

- Formal threat model for extension message passing and host permissions.
- Stronger policy extraction review workflow and source-clause traceability.
- Encryption strategy for sensitive local placeholder mappings and server records.
- Audit log immutability/access controls.
- Cross-organization isolation tests.

### Longer-term improvements

- Multi-site extension adapters beyond ChatGPT.
- Admin-visible false-positive/false-negative feedback loops.
- Safe override/approval workflow with policy evidence.
- Monitoring that avoids raw content.

## Validation Command Results

Commands were run without changing dependencies.

| Command | Result | Summary | Pre-existing? |
|---|---:|---|---|
| `node --version` | Pass | `v24.18.0` | N/A |
| `npm --version` | Pass | `11.16.0` | N/A |
| `pnpm --version` | Pass | `11.16.0` | N/A |
| `npm run lint` | Pass | Next lint completed without reported errors | N/A |
| `npm run build` | Pass | Next.js build completed; 16 routes generated | N/A |
| `npm run guard:typecheck` | Pass | WXT prepare plus TypeScript no-emit completed | N/A |
| `npm run guard:test` | Pass | 14 test files, 117 tests passed | N/A |
| `pnpm --filter @accord/governance-core typecheck` | Pass | Governance core TypeScript no-emit completed | N/A |
| `npm run guard:build` | Pass with warning | Chrome MV3 extension built; Tailwind warning about missing/empty content option | Warning appears pre-existing/configuration-level |
| `npm run eval:redaction` | Pass | 138 fixture cases; reported precision/recall 1.0; provider payload clean true | N/A |
| `npm run eval:person` | Pass | 308 fixture cases; detector status unavailable but fixture metrics reported 1.0 | N/A |

