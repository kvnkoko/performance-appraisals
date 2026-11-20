-- EMERGENCY ONLY: undo 20261120130000_phase2_lockdown.sql and reopen the tables the way they were
-- before Phase 2 (anyone with the public key can read and write everything, including password
-- hashes). The Phase 2 app keeps working in this state. Re-apply the lockdown as soon as possible.
--
-- Run with: supabase db query --linked -f supabase/pending/rollback_phase2_lockdown.sql

do $$
declare
  pol record;
  t text;
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

  foreach t in array array['appraisal_assignments', 'appraisal_links', 'appraisals', 'employee_profiles', 'employees',
                           'performance_summaries', 'review_periods', 'settings', 'teams', 'templates', 'users']
  loop
    execute format('grant all on public.%I to anon, authenticated', t);
    execute format('create policy "Allow all operations" on public.%I using (true) with check (true)', t);
  end loop;
end $$;

alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant all on functions to anon;
