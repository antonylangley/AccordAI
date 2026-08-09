alter table public.accord_company_members
  alter column user_id drop not null;

create unique index if not exists accord_company_members_company_invited_email_key
  on public.accord_company_members(company_slug, lower(email))
  where user_id is null and email is not null;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table public.accord_company_members to authenticated, service_role;
grant select on table public.accord_companies to authenticated, service_role;
grant insert, update on table public.accord_companies to service_role;

select pg_notify('pgrst', 'reload schema');
