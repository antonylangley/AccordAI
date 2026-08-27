alter table public.accord_policy_rules
  add column if not exists source_text text not null default '',
  add column if not exists requirement_summary text not null default '',
  add column if not exists control_type text not null default 'data_submission',
  add column if not exists enforceability text not null default 'fully_enforceable',
  add column if not exists destination_types text[] not null default '{}',
  add column if not exists recommended_action text,
  add column if not exists condition_description text not null default '',
  add column if not exists reasoning text not null default '',
  add column if not exists confidence numeric not null default 0.7,
  add column if not exists destination_authorizations jsonb not null default '[]'::jsonb;

update public.accord_policy_rules
set
  source_text = coalesce(nullif(source_text, ''), supporting_excerpt),
  requirement_summary = coalesce(nullif(requirement_summary, ''), name),
  destination_types = case
    when cardinality(destination_types) = 0 then array[destination_type]
    else destination_types
  end,
  recommended_action = coalesce(
    recommended_action,
    case action
      when 'transform' then 'redact'
      when 'allow' then null
      else action
    end
  ),
  condition_description = coalesce(nullif(condition_description, ''), 'Legacy rule imported before requirement-level enforceability metadata.'),
  reasoning = coalesce(nullif(reasoning, ''), 'Legacy rule retained as an enforceable organization policy rule.'),
  confidence = case
    when confidence < 0 then 0
    when confidence > 1 then 1
    else confidence
  end,
  destination_authorizations = case
    when jsonb_typeof(destination_authorizations) = 'array' then destination_authorizations
    else '[]'::jsonb
  end;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accord_policy_rules_control_type_valid'
  ) then
    alter table public.accord_policy_rules
      add constraint accord_policy_rules_control_type_valid
      check (
        control_type in (
          'data_submission',
          'destination_restriction',
          'data_redaction',
          'security_secret',
          'tool_usage',
          'human_review',
          'output_usage',
          'procedural',
          'monitoring',
          'other'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accord_policy_rules_enforceability_valid'
  ) then
    alter table public.accord_policy_rules
      add constraint accord_policy_rules_enforceability_valid
      check (enforceability in ('fully_enforceable', 'partially_enforceable', 'not_enforceable'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accord_policy_rules_recommended_action_valid'
  ) then
    alter table public.accord_policy_rules
      add constraint accord_policy_rules_recommended_action_valid
      check (recommended_action is null or recommended_action in ('block', 'warn', 'redact', 'require_approval'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accord_policy_rules_confidence_unit_interval'
  ) then
    alter table public.accord_policy_rules
      add constraint accord_policy_rules_confidence_unit_interval
      check (confidence >= 0 and confidence <= 1);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accord_policy_rules_destination_authorizations_array'
  ) then
    alter table public.accord_policy_rules
      add constraint accord_policy_rules_destination_authorizations_array
      check (jsonb_typeof(destination_authorizations) = 'array');
  end if;
end $$;

create index if not exists accord_policy_rules_enforceability_idx
  on public.accord_policy_rules(company_slug, enforceability, status);

select pg_notify('pgrst', 'reload schema');
