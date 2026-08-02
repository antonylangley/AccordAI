create table if not exists public.accord_companies (
  slug text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accord_extension_users (
  id text primary key,
  company_slug text not null references public.accord_companies(slug) on delete cascade,
  extension_install_id text not null,
  user_label text not null,
  surface text not null default 'chatgpt',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (company_slug, extension_install_id)
);

create table if not exists public.accord_extension_events (
  id text primary key,
  company_slug text not null references public.accord_companies(slug) on delete cascade,
  extension_user_id text references public.accord_extension_users(id) on delete set null,
  event_type text not null check (
    event_type in (
      'message_sent_to_ai',
      'message_blocked',
      'attachment_governed',
      'attachment_blocked',
      'assistant_response_rehydrated',
      'extension_error'
    )
  ),
  surface text not null default 'chatgpt',
  conversation_key_hash text not null,
  action text not null,
  risk_score integer not null default 0,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'critical')),
  flags text[] not null default '{}',
  entity_counts jsonb not null default '{}'::jsonb,
  redaction_count integer not null default 0,
  attachment_count integer not null default 0,
  message_length_bucket text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists accord_extension_events_company_created_idx
  on public.accord_extension_events(company_slug, created_at desc);

create index if not exists accord_extension_events_type_created_idx
  on public.accord_extension_events(event_type, created_at desc);

create index if not exists accord_extension_events_action_idx
  on public.accord_extension_events(action);

create index if not exists accord_extension_users_company_idx
  on public.accord_extension_users(company_slug, last_seen_at desc);

alter table public.accord_companies enable row level security;
alter table public.accord_extension_users enable row level security;
alter table public.accord_extension_events enable row level security;

insert into public.accord_companies (slug, name)
values ('test-company', 'Test Company')
on conflict (slug) do update set
  name = excluded.name,
  updated_at = now();
