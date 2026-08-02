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

create table if not exists public.accord_policy_rules (
  id text primary key,
  company_slug text not null references public.accord_companies(slug) on delete cascade,
  rule_key text not null,
  version integer not null default 1,
  name text not null,
  source_policy_name text not null,
  source_section text not null,
  supporting_excerpt text not null,
  data_categories text[] not null default '{}',
  user_scope text not null default 'all',
  department_scope text not null default 'all',
  ai_provider text not null default 'any',
  destination_type text not null check (destination_type in ('any', 'approved', 'enterprise', 'personal', 'unapproved')),
  action text not null check (action in ('allow', 'transform', 'warn', 'require_approval', 'block')),
  fallback_action text not null check (fallback_action in ('allow', 'transform', 'warn', 'require_approval', 'block')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  employee_explanation text not null,
  effective_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'archived')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  archived_at timestamptz,
  unique (company_slug, rule_key, version)
);

create table if not exists public.accord_policy_bundles (
  id text primary key,
  company_slug text not null references public.accord_companies(slug) on delete cascade,
  version integer not null,
  status text not null check (status in ('published', 'superseded')),
  checksum text not null,
  rule_count integer not null default 0,
  bundle jsonb not null,
  published_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_slug, version)
);

create index if not exists accord_policy_rules_company_status_idx
  on public.accord_policy_rules(company_slug, status, active);

create index if not exists accord_policy_rules_key_idx
  on public.accord_policy_rules(company_slug, rule_key, version desc);

create index if not exists accord_policy_bundles_company_status_idx
  on public.accord_policy_bundles(company_slug, status, version desc);

alter table public.accord_policy_rules enable row level security;
alter table public.accord_policy_bundles enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all on table public.accord_companies to anon, authenticated, service_role;
grant all on table public.accord_extension_users to anon, authenticated, service_role;
grant all on table public.accord_extension_events to anon, authenticated, service_role;
grant all on table public.accord_policy_rules to anon, authenticated, service_role;
grant all on table public.accord_policy_bundles to anon, authenticated, service_role;

alter table public.accord_extension_events
  add column if not exists organization_id text,
  add column if not exists employee_user_id text,
  add column if not exists rule_id text,
  add column if not exists rule_key text,
  add column if not exists rule_version integer,
  add column if not exists policy_bundle_version integer,
  add column if not exists policy_action text,
  add column if not exists policy_severity text,
  add column if not exists ai_provider text,
  add column if not exists destination_type text,
  add column if not exists content_type text,
  add column if not exists detected_categories text[] not null default '{}';

insert into public.accord_policy_rules (
  id,
  company_slug,
  rule_key,
  version,
  name,
  source_policy_name,
  source_section,
  supporting_excerpt,
  data_categories,
  user_scope,
  department_scope,
  ai_provider,
  destination_type,
  action,
  fallback_action,
  severity,
  employee_explanation,
  effective_date,
  status,
  active,
  approved_at
)
values (
  'rule_external_ai_client_info_v1',
  'test-company',
  'external_ai_client_info',
  1,
  'Do not submit client identifiers to personal AI',
  'External AI Usage Policy',
  '4.2 - Client Information',
  'Employees must not submit client names, addresses, account numbers, veterinary medical records, payment information, or other identifying information to personal or unapproved AI services. When identifying information can be removed without preventing the task, it must be removed before submission. If adequate de-identification is not possible, the submission must be blocked or routed for approval.',
  array[
    'client_identifying_info',
    'personal_data',
    'address',
    'account',
    'veterinary_medical_record',
    'payment_information'
  ],
  'all',
  'all',
  'chatgpt',
  'personal',
  'transform',
  'block',
  'high',
  'Client identifying information cannot be sent to personal AI. Accord will remove identifiers when it can do so safely, otherwise the submission is blocked or routed for approval.',
  current_date,
  'approved',
  true,
  now()
)
on conflict (company_slug, rule_key, version) do update set
  name = excluded.name,
  source_policy_name = excluded.source_policy_name,
  source_section = excluded.source_section,
  supporting_excerpt = excluded.supporting_excerpt,
  data_categories = excluded.data_categories,
  user_scope = excluded.user_scope,
  department_scope = excluded.department_scope,
  ai_provider = excluded.ai_provider,
  destination_type = excluded.destination_type,
  action = excluded.action,
  fallback_action = excluded.fallback_action,
  severity = excluded.severity,
  employee_explanation = excluded.employee_explanation,
  status = excluded.status,
  active = excluded.active,
  approved_at = coalesce(public.accord_policy_rules.approved_at, now()),
  updated_at = now();

select pg_notify('pgrst', 'reload schema');
