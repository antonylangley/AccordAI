-- Policy documents and compiled bundles can contain internal policy excerpts.
-- The extension receives the active bundle through Accord's server API; it does
-- not need direct anonymous Data API access to these tables.
revoke all on table public.accord_policy_rules from anon;
revoke all on table public.accord_policy_bundles from anon;

grant select, insert, update, delete on table public.accord_policy_rules to authenticated, service_role;
grant select, insert, update, delete on table public.accord_policy_bundles to authenticated, service_role;

alter table public.accord_policy_rules enable row level security;
alter table public.accord_policy_bundles enable row level security;

select pg_notify('pgrst', 'reload schema');
