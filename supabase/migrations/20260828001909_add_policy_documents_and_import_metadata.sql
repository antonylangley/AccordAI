create table if not exists public.accord_policy_documents (
  id text primary key,
  company_slug text not null references public.accord_companies(slug) on delete cascade,
  title text not null,
  description text not null default '',
  organization_name text,
  owner text,
  effective_date text,
  version_label text,
  scope text,
  source_file_name text not null,
  source_file_type text not null check (source_file_type in ('pdf', 'docx', 'doc', 'text')),
  extraction_confidence numeric not null default 0.6 check (extraction_confidence >= 0 and extraction_confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_slug, id),
  check (jsonb_typeof(metadata) = 'object'),
  check (jsonb_typeof(sections) = 'array')
);

alter table public.accord_policy_documents enable row level security;

grant select, insert, update, delete on table public.accord_policy_documents to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'accord_policy_documents'
      and policyname = 'Company members can manage policy documents'
  ) then
    create policy "Company members can manage policy documents"
      on public.accord_policy_documents
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.accord_company_members members
          where members.company_slug = accord_policy_documents.company_slug
            and members.user_id = (select auth.uid())
            and members.status = 'active'
        )
      )
      with check (
        exists (
          select 1
          from public.accord_company_members members
          where members.company_slug = accord_policy_documents.company_slug
            and members.user_id = (select auth.uid())
            and members.status = 'active'
        )
      );
  end if;
end $$;

alter table public.accord_policy_rules
  add column if not exists policy_document_id text references public.accord_policy_documents(id) on delete set null,
  add column if not exists requirement_id text,
  add column if not exists source_page integer,
  add column if not exists recommended_severity text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.accord_policy_rules
set recommended_severity = coalesce(recommended_severity, severity)
where recommended_severity is null;

alter table public.accord_policy_rules
  alter column recommended_severity set default 'medium',
  alter column recommended_severity set not null;

do $$
begin
  alter table public.accord_policy_rules
    drop constraint if exists accord_policy_rules_control_type_valid;

  alter table public.accord_policy_rules
    add constraint accord_policy_rules_control_type_valid
    check (
      control_type in (
        'data_submission',
        'destination_restriction',
        'data_redaction',
        'security_secret',
        'intellectual_property',
        'tool_usage',
        'human_review',
        'output_usage',
        'procedural',
        'monitoring',
        'other'
      )
    );

  if not exists (
    select 1 from pg_constraint where conname = 'accord_policy_rules_recommended_severity_valid'
  ) then
    alter table public.accord_policy_rules
      add constraint accord_policy_rules_recommended_severity_valid
      check (recommended_severity in ('low', 'medium', 'high', 'critical'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accord_policy_rules_metadata_object'
  ) then
    alter table public.accord_policy_rules
      add constraint accord_policy_rules_metadata_object
      check (jsonb_typeof(metadata) = 'object');
  end if;
end $$;

create index if not exists accord_policy_documents_company_idx
  on public.accord_policy_documents(company_slug, updated_at desc);

create index if not exists accord_policy_rules_policy_document_idx
  on public.accord_policy_rules(company_slug, policy_document_id);

create index if not exists accord_policy_rules_requirement_idx
  on public.accord_policy_rules(company_slug, requirement_id);

select pg_notify('pgrst', 'reload schema');
