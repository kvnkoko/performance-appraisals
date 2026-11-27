------------------------------------------------------------------------------
-- Fairer scoring, from December 2026 (scoring version 2). Periods scored before keep version 1.
--
-- Version 2 differs in two ways:
--   * Reviewer calibration. Each non-HR reviewer's habit of scoring people higher or lower than
--     the other reviewers of the same person is measured over the last 6 months and removed from
--     their forms. The adjustment is shrunk toward zero for reviewers with few comparisons.
--   * Manager cap. Manager reviews make up at most a third of the non-HR score.
-- Rankings also report Most Improved: this period's score against the person's average over
-- their previous 3 scored periods (at least 2 needed), scored the same way.
------------------------------------------------------------------------------

alter table public.review_periods add column if not exists scoring_version smallint not null default 2;
update public.review_periods set scoring_version = 1 where start_date < date '2026-12-01' and scoring_version <> 1;
alter table public.review_periods drop constraint if exists review_periods_scoring_version_check;
alter table public.review_periods add constraint review_periods_scoring_version_check check (scoring_version in (1, 2));

-- Only the database decides how a period is scored.
create or replace function public.review_periods_keep_scoring_version()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.scoring_version := case when new.start_date < date '2026-12-01' then 1 else 2 end;
  else
    new.scoring_version := old.scoring_version;
  end if;
  return new;
end
$$;
drop trigger if exists review_periods_keep_scoring_version on public.review_periods;
create trigger review_periods_keep_scoring_version before insert or update on public.review_periods
  for each row execute function public.review_periods_keep_scoring_version();

drop function if exists public.period_employee_scores(text);

-- p_version: null scores each period with its own version; 1 or 2 forces one method (used to
-- compare a period with earlier ones on equal terms).
create or replace function public.period_employee_scores(p_period_id text, p_version smallint default null)
returns table (review_period_id text, employee_id text, review_count integer, non_hr_count integer,
               overall_pct numeric, non_hr_pct numeric, hr_pct numeric, groups jsonb, scoring_version smallint)
language sql stable security definer set search_path = '' as $$
  with w as (
    select coalesce((select hr_score_weight from public.settings order by key limit 1), 30)::numeric / 100 as hr_weight
  ),
  forms as (
    select a.review_period_id, a.employee_id, a.appraiser_id, p.start_date,
           coalesce(p_version, p.scoring_version) as ver,
           public.appraisal_review_group(coalesce(a.template_snapshot ->> 'type', t.type), apr.hierarchy) as grp,
           a.score, a.max_score, 100 * a.score / a.max_score as pct
    from public.appraisals a
    join public.review_periods p on p.id = a.review_period_id
    join public.employees apr on apr.id = a.appraiser_id
    left join public.templates t on t.id = a.template_id
    where a.completed_at is not null and a.max_score > 0
  ),
  targets as (
    select distinct f.review_period_id, f.start_date from forms f
    where f.ver = 2 and (p_period_id is null or f.review_period_id = p_period_id)
  ),
  -- Non-HR forms from the 6 months up to each target period. Each form is modelled as
  -- (the person's level that period) + (the reviewer's leniency); the two are estimated in turn
  -- a few times, so a harsh reviewer does not make the others who rated the same people look generous.
  -- Leniency is shrunk toward zero (as if each reviewer had 10 extra average forms).
  wf as (
    select tg.review_period_id as tp, f.review_period_id as q, f.employee_id as e, f.appraiser_id as r, f.pct
    from targets tg
    join forms f on f.grp <> 'hr' and f.start_date <= tg.start_date and f.start_date > tg.start_date - interval '6 months'
  ),
  m0 as (select tp, q, e, avg(pct) as m from wf group by 1, 2, 3),
  b1 as (select wf.tp, wf.r, sum(wf.pct - m0.m) / (count(*) + 10) as b from wf join m0 using (tp, q, e) group by 1, 2),
  m1 as (select wf.tp, wf.q, wf.e, avg(wf.pct - b1.b) as m from wf join b1 using (tp, r) group by 1, 2, 3),
  b2 as (select wf.tp, wf.r, sum(wf.pct - m1.m) / (count(*) + 10) as b from wf join m1 using (tp, q, e) group by 1, 2),
  m2 as (select wf.tp, wf.q, wf.e, avg(wf.pct - b2.b) as m from wf join b2 using (tp, r) group by 1, 2, 3),
  b3 as (select wf.tp, wf.r, sum(wf.pct - m2.m) / (count(*) + 10) as b from wf join m2 using (tp, q, e) group by 1, 2),
  m3 as (select wf.tp, wf.q, wf.e, avg(wf.pct - b3.b) as m from wf join b3 using (tp, r) group by 1, 2, 3),
  b4 as (select wf.tp, wf.r, sum(wf.pct - m3.m) / (count(*) + 10) as b from wf join m3 using (tp, q, e) group by 1, 2),
  m4 as (select wf.tp, wf.q, wf.e, avg(wf.pct - b4.b) as m from wf join b4 using (tp, r) group by 1, 2, 3),
  b5 as (select wf.tp, wf.r, sum(wf.pct - m4.m) / (count(*) + 10) as b from wf join m4 using (tp, q, e) group by 1, 2),
  m5 as (select wf.tp, wf.q, wf.e, avg(wf.pct - b5.b) as m from wf join b5 using (tp, r) group by 1, 2, 3),
  b6 as (select wf.tp, wf.r, sum(wf.pct - m5.m) / (count(*) + 10) as b from wf join m5 using (tp, q, e) group by 1, 2),
  leniency as (
    select b6.tp as review_period_id, b6.r as appraiser_id, b6.b - avg(b6.b) over (partition by b6.tp) as lean from b6
  ),
  base as (
    select f.review_period_id, f.employee_id, f.grp, f.ver,
           case when f.ver = 2 and f.grp <> 'hr'
                then greatest(0, least(100, f.pct - coalesce(l.lean, 0)))
                else f.pct end as pct,
           f.score, f.max_score
    from forms f
    left join leniency l on l.review_period_id = f.review_period_id and l.appraiser_id = f.appraiser_id
    where p_period_id is null or f.review_period_id = p_period_id
  ),
  g as (
    select review_period_id, employee_id, grp, max(ver) as ver, count(*)::int as n,
           case when max(ver) = 2 then avg(pct) else 100 * sum(score) / sum(max_score) end as pct
    from base group by 1, 2, 3
  ),
  gw as (
    select g.*,
           count(*) filter (where grp <> 'hr') over pe as ngroups,
           bool_or(grp = 'manager') over pe as has_manager
    from g
    window pe as (partition by review_period_id, employee_id)
  ),
  weighted as (
    select gw.*,
           case
             when grp = 'hr' then null
             when ver = 1 or ngroups = 1 then 1.0 / ngroups
             when grp = 'manager' then least(1.0 / ngroups, 1.0 / 3)
             when has_manager then (1 - least(1.0 / ngroups, 1.0 / 3)) / (ngroups - 1)
             else 1.0 / ngroups
           end as weight
    from gw
  ),
  e as (
    select review_period_id, employee_id, max(ver)::smallint as ver,
           sum(n)::int as review_count,
           coalesce(sum(n) filter (where grp <> 'hr'), 0)::int as non_hr_count,
           case when max(ver) = 1 then avg(pct) filter (where grp <> 'hr')
                else sum(weight * pct) filter (where grp <> 'hr') end as non_hr_pct,
           max(pct) filter (where grp = 'hr') as hr_pct,
           jsonb_object_agg(grp, jsonb_build_object('count', n, 'pct', round(pct, 2))) as groups
    from weighted group by 1, 2
  )
  select e.review_period_id, e.employee_id, e.review_count, e.non_hr_count,
         round(case when e.non_hr_pct is null then e.hr_pct
                    when e.hr_pct is null then e.non_hr_pct
                    else (1 - w.hr_weight) * e.non_hr_pct + w.hr_weight * e.hr_pct end, 2),
         round(e.non_hr_pct, 2), round(e.hr_pct, 2), e.groups, e.ver
  from e cross join w
$$;
revoke all on function public.period_employee_scores(text, smallint) from public, anon, authenticated;

drop function if exists public.get_period_rankings(text);

create or replace function public.get_period_rankings(p_period_id text default null)
returns table (review_period_id text, employee_id text, board text, eligible boolean, not_ranked_reason text,
               review_count integer, non_hr_count integer, overall_pct numeric, non_hr_pct numeric, hr_pct numeric,
               groups jsonb, rank integer, scoring_version smallint, improvement numeric, improved_rank integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  require_hr boolean := coalesce((select require_hr_for_ranking from public.settings order by key limit 1), false);
begin
  if not public.app_is_admin() then
    raise exception 'Only administrators can see rankings.' using errcode = '42501';
  end if;
  return query
  with s as (
    select sc.*, p.start_date, e.hierarchy, e.employment_status,
           case when e.hierarchy = 'member' then 'members'
                when e.hierarchy in ('leader', 'department-leader') then 'leaders' end as board
    from public.period_employee_scores(p_period_id) sc
    join public.employees e on e.id = sc.employee_id
    join public.review_periods p on p.id = sc.review_period_id
  ),
  r as (
    select s.*,
           case
             when s.employment_status in ('terminated', 'resigned') then 'Former employee'
             when s.board is null then 'Not ranked (' || s.hierarchy || ')'
             when s.non_hr_count = 0 then 'Only an HR review so far'
             when require_hr and s.hr_pct is null then 'No HR review yet'
           end as reason
    from s
  ),
  -- Version 2 periods only: compare with the person's previous 3 scored periods, scored the same way.
  history as (
    select h.employee_id, p.start_date, h.overall_pct
    from public.period_employee_scores(null, 2::smallint) h
    join public.review_periods p on p.id = h.review_period_id
    where exists (select 1 from r where r.scoring_version = 2)
  ),
  imp as (
    select r.review_period_id, r.employee_id,
           case when count(prev.overall_pct) >= 2 then r.overall_pct - avg(prev.overall_pct) end as improvement
    from r
    left join lateral (
      select h.overall_pct from history h
      where h.employee_id = r.employee_id and h.start_date < r.start_date
      order by h.start_date desc limit 3
    ) prev on true
    where r.scoring_version = 2 and r.reason is null
    group by r.review_period_id, r.employee_id, r.overall_pct
  )
  select r.review_period_id, r.employee_id, r.board, r.reason is null, r.reason,
         r.review_count, r.non_hr_count, r.overall_pct, r.non_hr_pct, r.hr_pct, r.groups,
         case when r.reason is null
              then (rank() over (partition by r.review_period_id, r.reason is null order by r.overall_pct desc))::int
         end,
         r.scoring_version,
         round(imp.improvement, 2),
         case when imp.improvement is not null
              then (rank() over (partition by r.review_period_id, imp.improvement is not null order by imp.improvement desc))::int
         end
  from r
  left join imp on imp.review_period_id = r.review_period_id and imp.employee_id = r.employee_id;
end
$$;
revoke all on function public.get_period_rankings(text) from public, anon;
grant execute on function public.get_period_rankings(text) to authenticated;

-- Awards: 'overall' (Employee of the Period) and, for version 2 periods, 'improved' (Most Improved).
create or replace function public.set_period_award(p_period_id text, p_board text, p_employee_id text, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  chosen_rank integer;
  period_version smallint;
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.app_is_admin() then
    raise exception 'Only administrators can set awards.' using errcode = '42501';
  end if;
  if p_board is null or p_board not in ('overall', 'improved') then
    raise exception 'Unknown award.' using errcode = '22023';
  end if;
  select scoring_version into period_version from public.review_periods where id = p_period_id;
  if not found then
    raise exception 'That review period does not exist.' using errcode = '22023';
  end if;
  if p_board = 'improved' and period_version < 2 then
    raise exception 'Most Improved starts with December 2026.' using errcode = '22023';
  end if;
  if length(clean_reason) > 500 then
    raise exception 'Please keep the reason under 500 characters.' using errcode = '22023';
  end if;

  if p_employee_id is null then
    update public.settings
    set period_awards = period_awards #- array[p_period_id, p_board], updated_at = now()
    where key = 'company';
    return;
  end if;

  select case when p_board = 'overall' then r.rank else r.improved_rank end into chosen_rank
  from public.get_period_rankings(p_period_id) r
  where r.eligible and r.employee_id = p_employee_id
    and (p_board = 'overall' or r.improvement is not null);
  if not found then
    raise exception 'That person cannot get this award for this period.' using errcode = '22023';
  end if;
  if chosen_rank <> 1 and clean_reason is null then
    raise exception 'Please give a reason for choosing someone other than the top-ranked person.' using errcode = '22023';
  end if;

  update public.settings
  set period_awards = jsonb_set(
        case when period_awards ? p_period_id then period_awards
             else period_awards || jsonb_build_object(p_period_id, '{}'::jsonb) end,
        array[p_period_id, p_board],
        jsonb_build_object('employeeId', p_employee_id, 'reason', clean_reason,
                           'setBy', public.app_user_id(), 'setAt', now())),
      updated_at = now()
  where key = 'company';
end
$$;
revoke all on function public.set_period_award(text, text, text, text) from public, anon;
grant execute on function public.set_period_award(text, text, text, text) to authenticated;
