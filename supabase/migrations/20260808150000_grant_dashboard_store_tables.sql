grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table public.accord_workspace_memory to authenticated, service_role;
grant select, insert, update, delete on table public.accord_chat_sessions to authenticated, service_role;
grant select, insert, update, delete on table public.accord_chat_messages to authenticated, service_role;
grant select, insert, update, delete on table public.accord_governance_events to authenticated, service_role;
grant select, insert, update, delete on table public.accord_audit_events to authenticated, service_role;

notify pgrst, 'reload schema';
