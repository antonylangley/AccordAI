create extension if not exists pgcrypto;

alter table public.accord_companies
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create unique index if not exists accord_companies_id_key
  on public.accord_companies(id);

create table if not exists public.accord_company_members (
  id uuid primary key default gen_random_uuid(),
  company_slug text not null references public.accord_companies(slug) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_slug, user_id)
);

alter table public.accord_extension_users
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists department text,
  add column if not exists status text not null default 'active' check (status in ('active', 'suspended', 'revoked'));

alter table public.accord_chat_sessions
  add column if not exists company_slug text references public.accord_companies(slug) on delete set null;

alter table public.accord_governance_events
  add column if not exists company_slug text references public.accord_companies(slug) on delete set null;

update public.accord_chat_sessions
set company_slug = 'test-company'
where company_slug is null;

update public.accord_governance_events
set company_slug = 'test-company'
where company_slug is null;

create index if not exists accord_company_members_user_idx
  on public.accord_company_members(user_id, status);

create index if not exists accord_company_members_company_idx
  on public.accord_company_members(company_slug, role);

create index if not exists accord_chat_sessions_company_idx
  on public.accord_chat_sessions(company_slug, updated_at desc);

create index if not exists accord_governance_events_company_idx
  on public.accord_governance_events(company_slug, created_at desc);

alter table public.accord_company_members enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table public.accord_company_members to authenticated, service_role;
grant select on table public.accord_companies to authenticated, service_role;
grant select on table public.accord_extension_users to authenticated, service_role;
grant select on table public.accord_extension_events to authenticated, service_role;
grant select, insert, update, delete on table public.accord_policy_rules to authenticated, service_role;
grant select, insert, update, delete on table public.accord_policy_bundles to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'accord_company_members'
      and policyname = 'Members can read their own memberships'
  ) then
    create policy "Members can read their own memberships"
      on public.accord_company_members
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'accord_company_members'
      and policyname = 'Members can update their own membership profile'
  ) then
    create policy "Members can update their own membership profile"
      on public.accord_company_members
      for update
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'accord_companies'
      and policyname = 'Company members can read companies'
  ) then
    create policy "Company members can read companies"
      on public.accord_companies
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.accord_company_members members
          where members.company_slug = accord_companies.slug
            and members.user_id = (select auth.uid())
            and members.status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'accord_extension_events'
      and policyname = 'Company members can read extension events'
  ) then
    create policy "Company members can read extension events"
      on public.accord_extension_events
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.accord_company_members members
          where members.company_slug = accord_extension_events.company_slug
            and members.user_id = (select auth.uid())
            and members.status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'accord_policy_rules'
      and policyname = 'Company members can read policy rules'
  ) then
    create policy "Company members can read policy rules"
      on public.accord_policy_rules
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.accord_company_members members
          where members.company_slug = accord_policy_rules.company_slug
            and members.user_id = (select auth.uid())
            and members.status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'accord_policy_bundles'
      and policyname = 'Company members can read policy bundles'
  ) then
    create policy "Company members can read policy bundles"
      on public.accord_policy_bundles
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.accord_company_members members
          where members.company_slug = accord_policy_bundles.company_slug
            and members.user_id = (select auth.uid())
            and members.status = 'active'
        )
      );
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
