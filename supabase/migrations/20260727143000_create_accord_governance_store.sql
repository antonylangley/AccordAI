create table if not exists public.accord_workspace_memory (
  id text primary key,
  title text not null,
  kind text not null,
  summary text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accord_chat_sessions (
  id text primary key,
  title text not null,
  tenant text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accord_chat_messages (
  id text primary key,
  session_id text not null references public.accord_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  provider_id text not null,
  provider_label text not null,
  model text not null,
  redacted_preview text not null,
  raw_stored boolean not null default false,
  risk_score integer not null default 0,
  policy_action text not null check (policy_action in ('allow', 'warn', 'redact', 'block')),
  created_at timestamptz not null default now()
);

create table if not exists public.accord_governance_events (
  id text primary key,
  session_id text not null references public.accord_chat_sessions(id) on delete cascade,
  category text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  action_taken text not null,
  status text not null,
  provider text not null,
  user_label text not null,
  risk_score integer not null,
  redacted_preview text not null,
  flags text[] not null default '{}',
  policy_triggered text not null,
  recommended_action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.accord_audit_events (
  id text primary key,
  session_id text not null references public.accord_chat_sessions(id) on delete cascade,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists accord_chat_messages_session_created_idx
  on public.accord_chat_messages(session_id, created_at desc);

create index if not exists accord_governance_events_created_idx
  on public.accord_governance_events(created_at desc);

create index if not exists accord_governance_events_risk_idx
  on public.accord_governance_events(risk_score desc);

create index if not exists accord_audit_events_session_created_idx
  on public.accord_audit_events(session_id, created_at desc);

alter table public.accord_workspace_memory enable row level security;
alter table public.accord_chat_sessions enable row level security;
alter table public.accord_chat_messages enable row level security;
alter table public.accord_governance_events enable row level security;
alter table public.accord_audit_events enable row level security;

insert into public.accord_workspace_memory (id, title, kind, summary, source)
values
  (
    'mem_product_context',
    'Accord product context',
    'product_memory',
    'Accord is an AI governance and compliance platform. It routes employee AI usage through governed controls, scans prompts and attachments before and after model calls, redacts sensitive identifiers, and keeps audit-ready metadata without broad raw-content storage.',
    'seed'
  ),
  (
    'mem_privacy_boundary',
    'Governance without surveillance',
    'principle',
    'Store metadata, risk flags, policy decisions, redacted prompt previews, redacted response previews, and audit events by default. Do not store raw prompts, raw responses, original binary documents, or provider API keys in chat logs.',
    'seed'
  ),
  (
    'mem_guard_extension',
    'Accord Guard browser mode',
    'milestone',
    'The Chrome extension governs ChatGPT usage in browser mode: prompt redaction, governed attachment replacement, response rehydration, and local placeholder vaults scoped to the session.',
    'seed'
  )
on conflict (id) do nothing;
