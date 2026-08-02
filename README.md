# AccordAI

Accord is a privacy-first AI governance and compliance control plane prototype.

The app demonstrates:

- A branded enterprise SaaS landing page
- Governance overview dashboard
- Interactive governed chat prototype
- Risk event review workflow
- Policy configuration
- Audit report generation
- Provider settings and API token management

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Recharts
- Lucide React
- Supabase for persisted governance metadata

## Development

```bash
pnpm install
pnpm dev
```

Then open `http://127.0.0.1:3000`.

## Supabase

Accord persists redacted previews, policy decisions, risk metadata, and audit events in Supabase. Raw prompts, raw responses, uploaded source documents, and provider API keys are not stored by this app layer.

1. Run `supabase/migrations/20260727143000_create_accord_governance_store.sql` in your Supabase project.
2. Run `supabase/migrations/20260727152000_create_extension_telemetry.sql` to enable Chrome extension telemetry.
3. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`.

The Chrome extension sends telemetry to the local Accord server at `/api/guard/telemetry`. The extension never receives the Supabase service role key. Extension telemetry includes metadata such as message sent, message blocked, governed upload, risk score, redaction count, and policy flags.

## Validation

```bash
pnpm lint
pnpm build
```
