-- Phase 2, step 1: additive changes only. The currently deployed app keeps working after this runs.

------------------------------------------------------------------------------
-- Login accounts are linked to Supabase Auth users.
------------------------------------------------------------------------------
alter table public.users add column if not exists auth_user_id uuid unique;

------------------------------------------------------------------------------
-- Each submission keeps a copy of the template it was answered against, so
-- later template edits cannot change how historical appraisals read or score.
------------------------------------------------------------------------------
alter table public.appraisals add column if not exists template_snapshot jsonb;

------------------------------------------------------------------------------
-- Duplicate submissions (same reviewer, person and period) caused by the
-- re-review bug: keep the first submission, archive the others.
------------------------------------------------------------------------------
create table if not exists public.appraisals_superseded (like public.appraisals including defaults);
alter table public.appraisals_superseded
  add column if not exists superseded_at timestamptz not null default now(),
  add column if not exists superseded_reason text,
  add column if not exists kept_appraisal_id text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appraisals_superseded_pkey') then
    alter table public.appraisals_superseded add constraint appraisals_superseded_pkey primary key (id);
  end if;
end $$;

with ranked as (
  select id,
         first_value(id) over w as kept_id,
         row_number() over w as rn
  from public.appraisals
  window w as (partition by review_period_id, appraiser_id, employee_id order by completed_at nulls last, created_at, id)
)
insert into public.appraisals_superseded
select a.*, now(), 'Duplicate submission for the same reviewer, employee and period; first submission kept', r.kept_id
from public.appraisals a
join ranked r on r.id = a.id
where r.rn > 1
on conflict (id) do nothing;

delete from public.appraisals a
using public.appraisals_superseded s
where s.id = a.id;

create unique index if not exists appraisals_one_per_reviewer_employee_period
  on public.appraisals (review_period_id, appraiser_id, employee_id);

create unique index if not exists appraisal_assignments_unique_pair
  on public.appraisal_assignments (review_period_id, appraiser_id, employee_id, relationship_type);

------------------------------------------------------------------------------
-- Who is calling. Resolved live from public.users so role changes and locked
-- accounts take effect immediately, not when a token expires.
------------------------------------------------------------------------------
-- An account counts only while it is active and, if linked to an employee, that employee still
-- exists and has not left (terminated/resigned).
create or replace function public.app_current_user() returns public.users
language sql stable security definer set search_path = '' as $$
  select u.* from public.users u
  left join public.employees e on e.id = u.employee_id
  where u.auth_user_id = auth.uid()
    and coalesce(u.active, true)
    and (u.employee_id is null
         or (e.id is not null and coalesce(e.employment_status, 'permanent') not in ('terminated', 'resigned')))
  limit 1
$$;

create or replace function public.app_user_id() returns text
language sql stable security definer set search_path = '' as $$
  select (public.app_current_user()).id
$$;

create or replace function public.app_employee_id() returns text
language sql stable security definer set search_path = '' as $$
  select (public.app_current_user()).employee_id
$$;

create or replace function public.app_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((public.app_current_user()).role = 'admin', false)
$$;

------------------------------------------------------------------------------
-- Scoring, computed on the server so a submitted score cannot be tampered with.
-- Mirrors calculateScore() in src/lib/utils.ts.
------------------------------------------------------------------------------
create or replace function public.compute_appraisal_score(p_template jsonb, p_responses jsonb)
returns table (score numeric, max_score numeric, missing_required integer)
language plpgsql immutable set search_path = '' as $$
declare
  items jsonb;
  item jsonb;
  v text;
  r numeric;
  w numeric;
  s numeric := 0;
  m numeric := 0;
  miss integer := 0;
begin
  if jsonb_typeof(p_template -> 'categories') = 'array' and jsonb_array_length(p_template -> 'categories') > 0 then
    select coalesce(jsonb_agg(i), '[]'::jsonb) into items
    from jsonb_array_elements(p_template -> 'categories') c,
         jsonb_array_elements(coalesce(c -> 'items', '[]'::jsonb)) i;
  else
    items := coalesce(p_template -> 'questions', '[]'::jsonb);
  end if;

  for item in select value from jsonb_array_elements(items) loop
    w := coalesce((item ->> 'weight')::numeric, 0);
    m := m + w * 5;

    select resp ->> 'value' into v
    from jsonb_array_elements(coalesce(p_responses, '[]'::jsonb)) resp
    where resp ->> 'questionId' = item ->> 'id'
    limit 1;
    v := nullif(btrim(coalesce(v, '')), '');

    if v is null then
      if coalesce((item ->> 'required')::boolean, false) then
        miss := miss + 1;
      end if;
      continue;
    end if;

    r := null;
    if item ->> 'type' in ('rating-1-5', 'rating-1-10') then
      begin
        r := v::numeric;
      exception when others then
        r := null;
      end;
    end if;

    if item ->> 'type' = 'rating-1-5' and r between 1 and 5 then
      s := s + r * w;
    elsif item ->> 'type' = 'rating-1-10' and r / 2 between 0.5 and 5 then
      s := s + (r / 2) * w;
    elsif item ->> 'type' in ('text', 'multiple-choice') then
      s := s + w * 5;
    end if;
  end loop;

  score := round(s, 2);
  max_score := round(m, 2);
  missing_required := miss;
  return next;
end
$$;

------------------------------------------------------------------------------
-- Submitting an assigned form. Only the assigned reviewer can submit, only
-- once, and the score is computed here.
------------------------------------------------------------------------------
create or replace function public.submit_assignment_appraisal(p_assignment_id text, p_responses jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me text := public.app_employee_id();
  a public.appraisal_assignments;
  t public.templates;
  period_name text;
  sc record;
  new_id text;
begin
  if me is null then
    raise exception 'You must be signed in with an account linked to an employee to submit appraisals.' using errcode = '28000';
  end if;

  select * into a from public.appraisal_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'This appraisal form no longer exists.' using errcode = 'P0002';
  end if;
  if a.appraiser_id <> me then
    raise exception 'This appraisal form is assigned to someone else.' using errcode = '42501';
  end if;

  if a.status = 'completed' or exists (
    select 1 from public.appraisals p
    where p.review_period_id = a.review_period_id and p.appraiser_id = a.appraiser_id and p.employee_id = a.employee_id
  ) then
    update public.appraisal_assignments set status = 'completed' where id = a.id and status <> 'completed';
    return jsonb_build_object('status', 'already_submitted');
  end if;

  select * into t from public.templates where id = a.template_id;
  if not found then
    raise exception 'The template for this form no longer exists. Please contact an administrator.' using errcode = 'P0002';
  end if;

  select * into sc from public.compute_appraisal_score(to_jsonb(t), p_responses);
  if sc.missing_required > 0 then
    raise exception 'Please answer all required questions (% left).', sc.missing_required using errcode = '22023';
  end if;

  select name into period_name from public.review_periods where id = a.review_period_id;
  new_id := 'asg_' || a.id;

  begin
    insert into public.appraisals (id, template_id, employee_id, appraiser_id, review_period_id, review_period_name,
                                   responses, score, max_score, completed_at, created_at, template_snapshot)
    values (new_id, a.template_id, a.employee_id, a.appraiser_id, a.review_period_id, coalesce(period_name, 'Review Period'),
            coalesce(p_responses, '[]'::jsonb), sc.score, sc.max_score, now(), now(),
            to_jsonb(t) - 'created_at' - 'updated_at');
  exception when unique_violation then
    update public.appraisal_assignments set status = 'completed' where id = a.id and status <> 'completed';
    return jsonb_build_object('status', 'already_submitted');
  end;

  update public.appraisal_assignments set status = 'completed' where id = a.id;
  return jsonb_build_object('status', 'submitted', 'appraisal_id', new_id, 'score', sc.score, 'max_score', sc.max_score);
end
$$;

------------------------------------------------------------------------------
-- One-off appraisal links (no login). The token is the credential; the link
-- row itself is never exposed to anonymous callers.
------------------------------------------------------------------------------
create or replace function public.get_link_form(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  l public.appraisal_links;
  t public.templates;
  emp public.employees;
  apr public.employees;
  submitted boolean;
begin
  select * into l from public.appraisal_links where token = p_token;
  if not found then
    return null;
  end if;
  select * into t from public.templates where id = l.template_id;
  select * into emp from public.employees where id = l.employee_id;
  select * into apr from public.employees where id = l.appraiser_id;
  submitted := coalesce(l.used, false) or exists (select 1 from public.appraisals where id = 'lnk_' || l.id);

  return jsonb_build_object(
    'link', jsonb_build_object(
      'id', l.id, 'employee_id', l.employee_id, 'appraiser_id', l.appraiser_id, 'template_id', l.template_id,
      'review_period_id', l.review_period_id, 'review_period_name', l.review_period_name,
      'expires_at', l.expires_at, 'used', submitted, 'created_at', l.created_at, 'token', l.token),
    'template', case when t.id is null then null else to_jsonb(t) end,
    'employee', case when emp.id is null then null else jsonb_build_object('id', emp.id, 'name', emp.name, 'role', emp.role, 'hierarchy', emp.hierarchy) end,
    'appraiser', case when apr.id is null then null else jsonb_build_object('id', apr.id, 'name', apr.name, 'role', apr.role, 'hierarchy', apr.hierarchy) end
  );
end
$$;

create or replace function public.submit_link_appraisal(p_token text, p_responses jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.appraisal_links;
  t public.templates;
  sc record;
  period_id text;
  period_name text;
  new_id text;
begin
  select * into l from public.appraisal_links where token = p_token for update;
  if not found then
    raise exception 'This appraisal link does not exist.' using errcode = 'P0002';
  end if;
  if coalesce(l.used, false) or exists (select 1 from public.appraisals where id = 'lnk_' || l.id) then
    update public.appraisal_links set used = true where id = l.id and not coalesce(used, false);
    return jsonb_build_object('status', 'already_submitted');
  end if;
  if l.expires_at is not null and l.expires_at < now() then
    raise exception 'This appraisal link has expired.' using errcode = '22023';
  end if;

  period_id := coalesce(l.review_period_id, 'default');
  if exists (
    select 1 from public.appraisals p
    where p.review_period_id = period_id and p.appraiser_id = l.appraiser_id and p.employee_id = l.employee_id
  ) then
    update public.appraisal_links set used = true where id = l.id;
    return jsonb_build_object('status', 'already_submitted');
  end if;

  select * into t from public.templates where id = l.template_id;
  if not found then
    raise exception 'The template for this link no longer exists. Please contact an administrator.' using errcode = 'P0002';
  end if;

  select * into sc from public.compute_appraisal_score(to_jsonb(t), p_responses);
  if sc.missing_required > 0 then
    raise exception 'Please answer all required questions (% left).', sc.missing_required using errcode = '22023';
  end if;

  select name into period_name from public.review_periods where id = period_id;
  new_id := 'lnk_' || l.id;

  begin
    insert into public.appraisals (id, template_id, employee_id, appraiser_id, review_period_id, review_period_name,
                                   responses, score, max_score, completed_at, created_at, template_snapshot)
    values (new_id, l.template_id, l.employee_id, l.appraiser_id, period_id,
            coalesce(period_name, l.review_period_name, 'Initial Period'),
            coalesce(p_responses, '[]'::jsonb), sc.score, sc.max_score, now(), now(),
            to_jsonb(t) - 'created_at' - 'updated_at');
  exception when unique_violation then
    update public.appraisal_links set used = true where id = l.id;
    return jsonb_build_object('status', 'already_submitted');
  end;

  update public.appraisal_links set used = true where id = l.id;
  return jsonb_build_object('status', 'submitted', 'appraisal_id', new_id);
end
$$;

------------------------------------------------------------------------------
-- Self-service account changes for signed-in users.
------------------------------------------------------------------------------
create or replace function public.update_my_account(p_username text, p_email text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  clean_username text := lower(btrim(coalesce(p_username, '')));
begin
  if public.app_user_id() is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if clean_username = '' then
    raise exception 'Username cannot be empty.' using errcode = '22023';
  end if;
  begin
    update public.users
       set username = clean_username, email = nullif(btrim(coalesce(p_email, '')), '')
     where auth_user_id = auth.uid();
  exception when unique_violation then
    raise exception 'That username is already taken.' using errcode = '23505';
  end;
end
$$;

create or replace function public.complete_password_change()
returns void
language sql security definer set search_path = '' as $$
  update public.users set must_change_password = false where auth_user_id = auth.uid();
$$;

create or replace function public.record_login()
returns void
language sql security definer set search_path = '' as $$
  update public.users set last_login_at = now() where auth_user_id = auth.uid();
$$;

------------------------------------------------------------------------------
-- Audit log: every change to appraisal data, people and configuration.
------------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id text,
  actor_auth_role text,
  action text not null,
  table_name text not null,
  record_id text,
  changes jsonb
);
create index if not exists audit_log_occurred_at on public.audit_log (occurred_at desc);
create index if not exists audit_log_record on public.audit_log (table_name, record_id);

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
  values (public.app_user_id(), coalesce(auth.role(), current_user), lower(tg_op), tg_table_name, rec_id, diff);
  return null;
end
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'appraisals', 'appraisals_superseded', 'appraisal_assignments', 'appraisal_links', 'employees',
    'users', 'templates', 'review_periods', 'teams', 'settings'
  ] loop
    execute format('drop trigger if exists audit_changes on public.%I', tbl);
    execute format(
      'create trigger audit_changes after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      tbl);
  end loop;
end $$;

------------------------------------------------------------------------------
-- Function permissions. New functions default to executable by everyone in
-- this project, so grant explicitly.
------------------------------------------------------------------------------
revoke all on function public.app_current_user() from public, anon, authenticated;
revoke all on function public.app_user_id() from public, anon;
revoke all on function public.app_employee_id() from public, anon;
revoke all on function public.app_is_admin() from public, anon;
revoke all on function public.submit_assignment_appraisal(text, jsonb) from public, anon;
revoke all on function public.update_my_account(text, text) from public, anon;
revoke all on function public.complete_password_change() from public, anon;
revoke all on function public.record_login() from public, anon;
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.get_link_form(text) from public;
revoke all on function public.submit_link_appraisal(text, jsonb) from public;

grant execute on function public.app_user_id() to authenticated;
grant execute on function public.app_employee_id() to authenticated;
grant execute on function public.app_is_admin() to authenticated;
grant execute on function public.compute_appraisal_score(jsonb, jsonb) to anon, authenticated;
grant execute on function public.submit_assignment_appraisal(text, jsonb) to authenticated;
grant execute on function public.update_my_account(text, text) to authenticated;
grant execute on function public.complete_password_change() to authenticated;
grant execute on function public.record_login() to authenticated;
grant execute on function public.get_link_form(text) to anon, authenticated;
grant execute on function public.submit_link_appraisal(text, jsonb) to anon, authenticated;

alter table public.audit_log enable row level security;
alter table public.appraisals_superseded enable row level security;
revoke all on public.audit_log from anon, authenticated;
revoke all on public.appraisals_superseded from anon, authenticated;
