-- Phase 2, step 2: lock the database down. Apply only after the app version that signs in
-- through Supabase Auth is live; older app versions stop working once this runs.

------------------------------------------------------------------------------
-- Remove the old "anyone can do anything" policies.
------------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('appraisal_assignments', 'appraisal_links', 'appraisals', 'employee_profiles', 'employees',
                        'performance_summaries', 'review_periods', 'settings', 'teams', 'templates', 'users')
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

------------------------------------------------------------------------------
-- Table privileges. Anonymous visitors get nothing except the company
-- branding row; signed-in users are further limited by the policies below.
------------------------------------------------------------------------------
revoke all on public.appraisal_assignments, public.appraisal_links, public.appraisals, public.employee_profiles,
              public.employees, public.performance_summaries, public.review_periods, public.settings,
              public.teams, public.templates, public.users
  from anon, authenticated;

grant select on public.settings to anon;

grant select, insert, update, delete on public.appraisal_assignments, public.appraisal_links, public.appraisals,
      public.employee_profiles, public.employees, public.performance_summaries, public.review_periods,
      public.settings, public.teams, public.templates
  to authenticated;

-- Password hashes are never readable from the browser; account changes go through
-- the admin-users Edge Function and the self-service functions.
grant select (id, username, name, email, role, active, created_at, last_login_at, employee_id,
              must_change_password, auth_user_id)
  on public.users to authenticated;

grant select on public.audit_log, public.appraisals_superseded to authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

------------------------------------------------------------------------------
-- Policies.
------------------------------------------------------------------------------

-- Company settings: branding is public; only admins change anything.
create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_admin_write on public.settings for all to authenticated
  using ((select public.app_is_admin())) with check ((select public.app_is_admin()));

-- Org directory: every active signed-in user can read; admins write.
create policy employees_read on public.employees for select to authenticated
  using ((select public.app_user_id()) is not null);
create policy employees_admin_write on public.employees for all to authenticated
  using ((select public.app_is_admin())) with check ((select public.app_is_admin()));

create policy teams_read on public.teams for select to authenticated
  using ((select public.app_user_id()) is not null);
create policy teams_admin_write on public.teams for all to authenticated
  using ((select public.app_is_admin())) with check ((select public.app_is_admin()));

create policy review_periods_read on public.review_periods for select to authenticated
  using ((select public.app_user_id()) is not null);
create policy review_periods_admin_write on public.review_periods for all to authenticated
  using ((select public.app_is_admin())) with check ((select public.app_is_admin()));

create policy templates_read on public.templates for select to authenticated
  using ((select public.app_user_id()) is not null);
create policy templates_admin_write on public.templates for all to authenticated
  using ((select public.app_is_admin())) with check ((select public.app_is_admin()));

-- Profiles: everyone reads; people edit their own, admins edit any.
create policy employee_profiles_read on public.employee_profiles for select to authenticated
  using ((select public.app_user_id()) is not null);
create policy employee_profiles_write on public.employee_profiles for all to authenticated
  using ((select public.app_is_admin()) or employee_id = (select public.app_employee_id()))
  with check ((select public.app_is_admin()) or employee_id = (select public.app_employee_id()));

-- Submitted appraisals: admins see everything; staff see reviews they wrote and reviews about
-- themselves. Staff never write directly; they submit through submit_assignment_appraisal.
create policy appraisals_read on public.appraisals for select to authenticated
  using (
    (select public.app_is_admin())
    or appraiser_id = (select public.app_employee_id())
    or employee_id = (select public.app_employee_id())
  );
create policy appraisals_admin_write on public.appraisals for all to authenticated
  using ((select public.app_is_admin())) with check ((select public.app_is_admin()));

-- Forms and links: staff see only the ones they have to fill in.
create policy assignments_read on public.appraisal_assignments for select to authenticated
  using ((select public.app_is_admin()) or appraiser_id = (select public.app_employee_id()));
create policy assignments_admin_write on public.appraisal_assignments for all to authenticated
  using ((select public.app_is_admin())) with check ((select public.app_is_admin()));

create policy links_read on public.appraisal_links for select to authenticated
  using ((select public.app_is_admin()) or appraiser_id = (select public.app_employee_id()));
create policy links_admin_write on public.appraisal_links for all to authenticated
  using ((select public.app_is_admin())) with check ((select public.app_is_admin()));

-- AI summaries: admins, and the person the summary is about.
create policy summaries_read on public.performance_summaries for select to authenticated
  using ((select public.app_is_admin()) or employee_id = (select public.app_employee_id()));
create policy summaries_admin_write on public.performance_summaries for all to authenticated
  using ((select public.app_is_admin())) with check ((select public.app_is_admin()));

-- Login accounts: admins see all, everyone sees their own. No direct writes.
create policy users_read on public.users for select to authenticated
  using ((select public.app_is_admin()) or auth_user_id = auth.uid());

-- Audit trail and archived duplicates: admins only, read-only.
drop policy if exists audit_log_admin_read on public.audit_log;
drop policy if exists superseded_admin_read on public.appraisals_superseded;
create policy audit_log_admin_read on public.audit_log for select to authenticated
  using ((select public.app_is_admin()));
create policy superseded_admin_read on public.appraisals_superseded for select to authenticated
  using ((select public.app_is_admin()));

------------------------------------------------------------------------------
-- The admin PIN is retired.
------------------------------------------------------------------------------
update public.settings set admin_pin = '' where admin_pin <> '';
