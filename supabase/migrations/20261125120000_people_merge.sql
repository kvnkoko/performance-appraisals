-- People merge: every login belongs to exactly one person (employee), and the person record is
-- the single source of truth for name and email. The tables stay separate: employees hold the
-- person, users hold the sign-in (username, admin access, locked, Supabase Auth link).

------------------------------------------------------------------------------
-- Audit: allow server functions running as the service role to record which admin acted.
------------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  diff jsonb;
  rec_id text;
begin
  -- Never copy password hashes or large image data into the log.
  old_row := old_row - 'password_hash' - 'profile_picture' - 'cover_photo' - 'logo';
  new_row := new_row - 'password_hash' - 'profile_picture' - 'cover_photo' - 'logo';

  rec_id := coalesce(new_row ->> 'id', old_row ->> 'id', new_row ->> 'key', old_row ->> 'key');

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('old', old_row -> k, 'new', new_row -> k))
      into diff
    from jsonb_object_keys(new_row) k
    where (old_row -> k) is distinct from (new_row -> k);
    if diff is null then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    diff := new_row;
  else
    diff := old_row;
  end if;

  insert into public.audit_log (actor_user_id, actor_auth_role, action, table_name, record_id, changes)
  values (coalesce(public.app_user_id(), nullif(current_setting('app.actor_user_id', true), '')),
          coalesce(auth.role(), current_user), lower(tg_op), tg_table_name, rec_id, diff);
  return null;
end
$$;

------------------------------------------------------------------------------
-- Keep copies of the person's name and email in step.
------------------------------------------------------------------------------
-- A login always shows its person's name and email.
create or replace function public.users_take_person_details()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  e public.employees;
begin
  if new.employee_id is not null then
    select * into e from public.employees where id = new.employee_id;
    if found then
      new.name := e.name;
      new.email := e.email;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists users_take_person_details on public.users;
create trigger users_take_person_details
  before insert or update of employee_id, name, email on public.users
  for each row execute function public.users_take_person_details();

-- When a person changes: copy name/email to their login and to the name copies on forms, and
-- lock or unlock the login when they leave or come back.
create or replace function public.employees_sync_people()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  was_locked boolean := coalesce(old.employment_status, 'permanent') in ('terminated', 'resigned');
  now_locked boolean := coalesce(new.employment_status, 'permanent') in ('terminated', 'resigned');
begin
  if new.name is distinct from old.name or new.email is distinct from old.email then
    update public.users set name = new.name, email = new.email
     where employee_id = new.id and (name is distinct from new.name or email is distinct from new.email);
  end if;

  if new.name is distinct from old.name then
    update public.appraisal_assignments set employee_name = new.name
     where employee_id = new.id and employee_name is distinct from new.name;
    update public.appraisal_assignments set appraiser_name = new.name
     where appraiser_id = new.id and appraiser_name is distinct from new.name;
  end if;

  if now_locked and not was_locked then
    if exists (select 1 from public.users where employee_id = new.id and role = 'admin' and coalesce(active, true))
       and not exists (select 1 from public.users where role = 'admin' and coalesce(active, true)
                         and employee_id is distinct from new.id) then
      raise exception 'This person is the only active administrator. Give someone else admin access first.'
        using errcode = 'P0001';
    end if;
    update public.users set active = false where employee_id = new.id and coalesce(active, true);
  elsif was_locked and not now_locked then
    update public.users set active = true where employee_id = new.id and not coalesce(active, true);
  end if;
  return null;
end
$$;

drop trigger if exists employees_sync_people on public.employees;
create trigger employees_sync_people
  after update of name, email, employment_status on public.employees
  for each row execute function public.employees_sync_people();

------------------------------------------------------------------------------
-- Data fixes (each is safe to re-run).
------------------------------------------------------------------------------
-- 1. Hein Sitt Mhue's login points at a person that was deleted. Restore them as a former
--    employee so the login has an owner; the login stays locked.
insert into public.employees (id, name, email, role, hierarchy, created_at, employment_status)
select u.employee_id, u.name, u.email, 'Former employee', 'member', timestamptz '2026-01-28 06:16:01.341+00', 'resigned'
  from public.users u
 where u.id = '1769580963077-u8flai6mg'
   and u.employee_id = '1769580961341-87pqhlrs3'
   and not exists (select 1 from public.employees e where e.id = u.employee_id)
on conflict (id) do nothing;
update public.users set active = false where id = '1769580963077-u8flai6mg' and coalesce(active, true);

-- 2. Correct spelling is "Ei Shwe Sin Phyo" (the login had it right). The trigger above updates
--    the login and the name copies on forms.
update public.employees e set name = 'Ei Shwe Sin Phyo'
  from public.users u
 where u.employee_id = e.id and u.username = 'eishwesinphyo' and e.name = 'Ei Shwe Zin Phyo';

-- 3. Emails that were only on the login move to the person.
update public.employees e set email = btrim(u.email)
  from public.users u
 where u.employee_id = e.id and nullif(btrim(coalesce(e.email, '')), '') is null
   and nullif(btrim(coalesce(u.email, '')), '') is not null;

-- 4. Admins: give admin access to the person's own login, then switch off the separate
--    "<username>.admin" login (kept for history). Promote first so an admin always exists.
update public.users s set role = 'admin'
  from public.users a
 where a.username = s.username || '.admin'
   and a.role = 'admin' and coalesce(a.active, true) and a.employee_id is null
   and s.employee_id is not null and coalesce(s.active, true) and s.role <> 'admin';

update public.users a set active = false
 where a.role = 'admin' and a.employee_id is null and coalesce(a.active, true)
   and exists (select 1 from public.users s
                where s.username || '.admin' = a.username and s.role = 'admin'
                  and coalesce(s.active, true) and s.employee_id is not null);

-- 5. Bring every login's name/email in line with its person.
update public.users u set name = e.name, email = e.email
  from public.employees e
 where e.id = u.employee_id and (u.name is distinct from e.name or u.email is distinct from e.email);

------------------------------------------------------------------------------
-- Rules.
------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_employee_id_fkey') then
    alter table public.users
      add constraint users_employee_id_fkey foreign key (employee_id)
      references public.employees (id) on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_active_needs_person') then
    alter table public.users
      add constraint users_active_needs_person check (employee_id is not null or active = false);
  end if;
end $$;

create unique index if not exists users_employee_id_key on public.users (employee_id) where employee_id is not null;

------------------------------------------------------------------------------
-- Creating and deleting a person together with their login, in one transaction.
-- Called only by the admin-users server function (service role), which checks the caller is an
-- admin and handles the Supabase Auth side.
------------------------------------------------------------------------------
create or replace function public.admin_create_person(p_actor text, p_employee jsonb, p_login jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.employees;
begin
  perform set_config('app.actor_user_id', coalesce(p_actor, ''), true);
  e := jsonb_populate_record(null::public.employees, p_employee);
  if coalesce(btrim(e.id), '') = '' or coalesce(btrim(e.name), '') = '' then
    raise exception 'Name is required.' using errcode = '22023';
  end if;
  insert into public.employees (id, name, email, role, hierarchy, created_at, team_id, reports_to, employment_status)
  values (e.id, btrim(e.name), nullif(btrim(coalesce(e.email, '')), ''), coalesce(e.role, ''), e.hierarchy,
          coalesce(e.created_at, now()), e.team_id, e.reports_to, coalesce(e.employment_status, 'permanent'));

  insert into public.users (id, username, password_hash, name, role, active, employee_id, must_change_password, created_at)
  values (p_login ->> 'id', lower(btrim(p_login ->> 'username')), '!supabase-auth', e.name,
          case when p_login ->> 'role' = 'admin' then 'admin' else 'staff' end,
          coalesce(e.employment_status, 'permanent') not in ('terminated', 'resigned'),
          e.id, coalesce((p_login ->> 'mustChangePassword')::boolean, true), now());
end
$$;

-- Returns the Supabase Auth user id of the deleted login (if any) so the caller can remove it.
create or replace function public.admin_delete_person(p_actor text, p_employee_id text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  submitted integer;
  reports integer;
  login public.users;
begin
  perform set_config('app.actor_user_id', coalesce(p_actor, ''), true);
  if not exists (select 1 from public.employees where id = p_employee_id) then
    return null;
  end if;

  select count(*) into submitted from public.appraisals where employee_id = p_employee_id or appraiser_id = p_employee_id;
  if submitted > 0 then
    raise exception 'This person has % submitted appraisal(s) on record. To keep the history, set their employment status to Resigned or Terminated instead of deleting them.', submitted
      using errcode = 'P0001';
  end if;
  select count(*) into reports from public.employees where reports_to = p_employee_id and id <> p_employee_id;
  if reports > 0 then
    raise exception '% person(s) report to this person. Change their "Reports to" first, then delete.', reports
      using errcode = 'P0001';
  end if;

  select * into login from public.users where employee_id = p_employee_id;
  if login.id is not null then
    if login.id = p_actor then
      raise exception 'You cannot delete yourself.' using errcode = 'P0001';
    end if;
    if login.role = 'admin' and coalesce(login.active, true)
       and not exists (select 1 from public.users where role = 'admin' and coalesce(active, true) and id <> login.id) then
      raise exception 'This person is the only active administrator.' using errcode = 'P0001';
    end if;
  end if;

  delete from public.appraisal_assignments
   where (employee_id = p_employee_id or appraiser_id = p_employee_id) and status <> 'completed';
  delete from public.appraisal_links
   where (employee_id = p_employee_id or appraiser_id = p_employee_id) and not coalesce(used, false);
  delete from public.employee_profiles where employee_id = p_employee_id;
  delete from public.performance_summaries where employee_id = p_employee_id;
  delete from public.users where employee_id = p_employee_id;
  delete from public.employees where id = p_employee_id;
  return login.auth_user_id;
end
$$;

------------------------------------------------------------------------------
-- Self-service: the email belongs to the person, the username to the login.
------------------------------------------------------------------------------
create or replace function public.update_my_account(p_username text, p_email text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.users := public.app_current_user();
  clean_username text := lower(btrim(coalesce(p_username, '')));
  clean_email text := nullif(btrim(coalesce(p_email, '')), '');
begin
  if me.id is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if clean_username = '' then
    raise exception 'Username cannot be empty.' using errcode = '22023';
  end if;
  begin
    update public.users set username = clean_username where id = me.id and username <> clean_username;
  exception when unique_violation then
    raise exception 'That username is already taken.' using errcode = '23505';
  end;
  if me.employee_id is not null then
    update public.employees set email = clean_email where id = me.employee_id and email is distinct from clean_email;
  else
    update public.users set email = clean_email where id = me.id and email is distinct from clean_email;
  end if;
end
$$;

revoke all on function public.users_take_person_details() from public, anon, authenticated;
revoke all on function public.employees_sync_people() from public, anon, authenticated;
revoke all on function public.admin_create_person(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.admin_delete_person(text, text) from public, anon, authenticated;
grant execute on function public.admin_create_person(text, jsonb, jsonb) to service_role;
grant execute on function public.admin_delete_person(text, text) to service_role;
