-- Admins can look at the app as another person ("View as", read-only). Each start and stop is
-- written to the audit log so it is clear who looked at whose view and when.
create or replace function public.log_view_as(p_action text, p_employee_id text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.app_is_admin() then
    raise exception 'Only administrators can use View as.' using errcode = '42501';
  end if;
  if p_action not in ('start', 'stop') then
    raise exception 'Unknown View as action.' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_user_id, actor_auth_role, action, table_name, record_id, changes)
  values (public.app_user_id(), 'authenticated', 'view_as_' || p_action, 'employees', p_employee_id,
          coalesce(p_details, '{}'::jsonb));
end
$$;

revoke all on function public.log_view_as(text, text, jsonb) from public, anon;
grant execute on function public.log_view_as(text, text, jsonb) to authenticated;
