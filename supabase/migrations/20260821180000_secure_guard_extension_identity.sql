-- Add server-verifiable identity keys to Guard telemetry while preserving the
-- legacy text columns used by existing dashboard queries.

alter table public.accord_extension_events
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists organization_uuid uuid references public.accord_companies(id) on delete set null;

create index if not exists accord_extension_events_auth_user_created_idx
  on public.accord_extension_events(auth_user_id, created_at desc);

create index if not exists accord_extension_events_organization_created_idx
  on public.accord_extension_events(organization_uuid, created_at desc);

-- The existing self-service membership update policy is retained for profile
-- compatibility, but identity, organization, role, and status are immutable
-- for authenticated browser clients. Server/service-role administration is
-- unaffected.
create or replace function public.protect_accord_membership_authority()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') = 'authenticated' then
    new.user_id := old.user_id;
    new.company_slug := old.company_slug;
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_accord_membership_authority
  on public.accord_company_members;

create trigger protect_accord_membership_authority
before update on public.accord_company_members
for each row execute function public.protect_accord_membership_authority();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'accord_extension_users'
      and policyname = 'Company members can read extension users'
  ) then
    create policy "Company members can read extension users"
      on public.accord_extension_users
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.accord_company_members members
          where members.company_slug = accord_extension_users.company_slug
            and members.user_id = (select auth.uid())
            and members.status = 'active'
        )
      );
  end if;
end $$;

-- Extension clients synchronize through authenticated server routes. Undo the
-- legacy broad Data API grants so browser sessions cannot write telemetry or
-- extension identities directly; authenticated users retain only the
-- organization-scoped read access granted by the RLS policy above.
revoke all on table public.accord_extension_users from anon;
revoke all on table public.accord_extension_events from anon;
revoke insert, update, delete on table public.accord_extension_users from authenticated;
revoke insert, update, delete on table public.accord_extension_events from authenticated;
grant select on table public.accord_extension_users to authenticated;
grant select on table public.accord_extension_events to authenticated;
grant all on table public.accord_extension_users to service_role;
grant all on table public.accord_extension_events to service_role;

select pg_notify('pgrst', 'reload schema');
