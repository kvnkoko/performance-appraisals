-- Phase 4: fair rankings, late submissions, rating limits on the server, reviewer anonymity.

------------------------------------------------------------------------------
-- Settings that the app already showed but never stored, plus awards per period.
------------------------------------------------------------------------------
alter table public.settings add column if not exists hr_score_weight integer not null default 30;
alter table public.settings add column if not exists require_hr_for_ranking boolean not null default false;
-- { "<period id>": { "members": {"employeeId", "reason", "setBy", "setAt"}, "leaders": {...} } }
alter table public.settings add column if not exists period_awards jsonb not null default '{}'::jsonb;
alter table public.settings drop constraint if exists settings_hr_score_weight_range;
alter table public.settings add constraint settings_hr_score_weight_range check (hr_score_weight between 0 and 100);

-- Days after the deadline a form was submitted (0 = on time). Set by the server at submission.
alter table public.appraisals add column if not exists late_days integer;

------------------------------------------------------------------------------
-- Deadlines. A form is due at the end of its review period (or the date an administrator
-- reopened it to) and can still be submitted for 7 days after that, marked late.
------------------------------------------------------------------------------
create or replace function public.app_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Yangon')::date
$$;

create or replace function public.submission_window(p_period_end date, p_reopened timestamptz)
returns table (cutoff date, late_days integer)
language sql stable set search_path = '' as $$
  select
    coalesce(greatest(p_period_end, (p_reopened at time zone 'Asia/Yangon')::date), p_period_end,
             (p_reopened at time zone 'Asia/Yangon')::date) + 7,
    greatest(public.app_today() - coalesce(p_period_end, (p_reopened at time zone 'Asia/Yangon')::date), 0)
$$;

------------------------------------------------------------------------------
-- Scoring: only rating questions count. Text and multiple-choice answers are kept but unscored.
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
    if item ->> 'type' in ('rating-1-5', 'rating-1-10') then
      m := m + w * 5;
    end if;

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
    end if;
  end loop;

  score := round(s, 2);
  max_score := round(m, 2);
  missing_required := miss;
  return next;
end
$$;

------------------------------------------------------------------------------
-- Rating limits (src/lib/rating-limits.ts): at most 2 × 1, 4 × 2, 4 × 4 and 2 × 5 per form.
-- HR reviews have no limits.
------------------------------------------------------------------------------
create or replace function public.check_rating_limits(p_template jsonb, p_responses jsonb)
returns void
language plpgsql immutable set search_path = '' as $$
declare
  limits constant jsonb := '{"1": 2, "2": 4, "4": 4, "5": 2}';
  labels constant jsonb := '{"1": "Not Acceptable", "2": "Improvement Needed", "4": "Better Than Expected", "5": "Outstanding"}';
  rec record;
begin
  for rec in
    select resp ->> 'value' as rating, count(*) as n
    from jsonb_array_elements(coalesce(p_responses, '[]'::jsonb)) resp
    where resp ->> 'questionId' in (
      select i ->> 'id'
      from jsonb_array_elements(case when jsonb_typeof(p_template -> 'categories') = 'array'
                                     then p_template -> 'categories' else '[]'::jsonb end) c,
           jsonb_array_elements(case when jsonb_typeof(c -> 'items') = 'array' then c -> 'items' else '[]'::jsonb end) i
      where i ->> 'type' = 'rating-1-5'
      union
      select q ->> 'id'
      from jsonb_array_elements(case when jsonb_typeof(p_template -> 'questions') = 'array'
                                     then p_template -> 'questions' else '[]'::jsonb end) q
      where q ->> 'type' = 'rating-1-5'
    )
    group by 1
  loop
    if limits ? rec.rating and rec.n > (limits ->> rec.rating)::int then
      raise exception '"%" can be chosen at most % times per form (this form has %).',
        labels ->> rec.rating, limits ->> rec.rating, rec.n using errcode = '22023';
    end if;
  end loop;
end
$$;

------------------------------------------------------------------------------
-- Submitting an assigned form: assigned reviewer only, once, before the cutoff, within the
-- rating limits; score and lateness are computed here.
------------------------------------------------------------------------------
create or replace function public.submit_assignment_appraisal(p_assignment_id text, p_responses jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me text := public.app_employee_id();
  a public.appraisal_assignments;
  t public.templates;
  p public.review_periods;
  me_hierarchy text;
  win record;
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
    select 1 from public.appraisals x
    where x.review_period_id = a.review_period_id and x.appraiser_id = a.appraiser_id and x.employee_id = a.employee_id
  ) then
    update public.appraisal_assignments set status = 'completed' where id = a.id and status <> 'completed';
    return jsonb_build_object('status', 'already_submitted');
  end if;

  select * into p from public.review_periods where id = a.review_period_id;
  select * into win from public.submission_window(p.end_date, a.due_date);
  if win.cutoff is not null and public.app_today() > win.cutoff then
    raise exception 'The deadline for this form passed on %. Ask an administrator to reopen it.',
      to_char(win.cutoff, 'FMDD Mon YYYY') using errcode = '22023';
  end if;

  select * into t from public.templates where id = a.template_id;
  if not found then
    raise exception 'The template for this form no longer exists. Please contact an administrator.' using errcode = 'P0002';
  end if;

  select hierarchy into me_hierarchy from public.employees where id = me;
  if not (t.type = 'hr-to-all' or a.relationship_type = 'hr-to-all' or me_hierarchy = 'hr') then
    perform public.check_rating_limits(to_jsonb(t), p_responses);
  end if;

  select * into sc from public.compute_appraisal_score(to_jsonb(t), p_responses);
  if sc.missing_required > 0 then
    raise exception 'Please answer all required questions (% left).', sc.missing_required using errcode = '22023';
  end if;

  new_id := 'asg_' || a.id;
  begin
    insert into public.appraisals (id, template_id, employee_id, appraiser_id, review_period_id, review_period_name,
                                   responses, score, max_score, completed_at, created_at, template_snapshot, late_days)
    values (new_id, a.template_id, a.employee_id, a.appraiser_id, a.review_period_id, coalesce(p.name, 'Review Period'),
            coalesce(p_responses, '[]'::jsonb), sc.score, sc.max_score, now(), now(),
            to_jsonb(t) - 'created_at' - 'updated_at', coalesce(win.late_days, 0));
  exception when unique_violation then
    update public.appraisal_assignments set status = 'completed' where id = a.id and status <> 'completed';
    return jsonb_build_object('status', 'already_submitted');
  end;

  update public.appraisal_assignments set status = 'completed' where id = a.id;
  return jsonb_build_object('status', 'submitted', 'appraisal_id', new_id, 'score', sc.score, 'max_score', sc.max_score,
                            'late_days', coalesce(win.late_days, 0));
end
$$;

create or replace function public.submit_link_appraisal(p_token text, p_responses jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.appraisal_links;
  t public.templates;
  p public.review_periods;
  apr_hierarchy text;
  win record;
  sc record;
  period_id text;
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
    select 1 from public.appraisals x
    where x.review_period_id = period_id and x.appraiser_id = l.appraiser_id and x.employee_id = l.employee_id
  ) then
    update public.appraisal_links set used = true where id = l.id;
    return jsonb_build_object('status', 'already_submitted');
  end if;

  select * into p from public.review_periods where id = period_id;
  -- A link issued after the period ended acts as a reopen: it gets its own 7 days.
  select * into win from public.submission_window(p.end_date, l.created_at);
  if win.cutoff is not null and public.app_today() > win.cutoff then
    raise exception 'The deadline for this form passed on %. Ask an administrator for a new link.',
      to_char(win.cutoff, 'FMDD Mon YYYY') using errcode = '22023';
  end if;

  select * into t from public.templates where id = l.template_id;
  if not found then
    raise exception 'The template for this link no longer exists. Please contact an administrator.' using errcode = 'P0002';
  end if;

  select hierarchy into apr_hierarchy from public.employees where id = l.appraiser_id;
  if not (t.type = 'hr-to-all' or apr_hierarchy = 'hr') then
    perform public.check_rating_limits(to_jsonb(t), p_responses);
  end if;

  select * into sc from public.compute_appraisal_score(to_jsonb(t), p_responses);
  if sc.missing_required > 0 then
    raise exception 'Please answer all required questions (% left).', sc.missing_required using errcode = '22023';
  end if;

  new_id := 'lnk_' || l.id;
  begin
    insert into public.appraisals (id, template_id, employee_id, appraiser_id, review_period_id, review_period_name,
                                   responses, score, max_score, completed_at, created_at, template_snapshot, late_days)
    values (new_id, l.template_id, l.employee_id, l.appraiser_id, period_id,
            coalesce(p.name, l.review_period_name, 'Initial Period'),
            coalesce(p_responses, '[]'::jsonb), sc.score, sc.max_score, now(), now(),
            to_jsonb(t) - 'created_at' - 'updated_at', coalesce(win.late_days, 0));
  exception when unique_violation then
    update public.appraisal_links set used = true where id = l.id;
    return jsonb_build_object('status', 'already_submitted');
  end;

  update public.appraisal_links set used = true where id = l.id;
  return jsonb_build_object('status', 'submitted', 'appraisal_id', new_id, 'late_days', coalesce(win.late_days, 0));
end
$$;

------------------------------------------------------------------------------
-- Fair scoring. Reviews are grouped by who wrote them; each group is averaged on its own, the
-- non-HR groups count equally, and HR is blended in at the configured weight. Having more
-- reviewers in a group adds accuracy, not weight.
------------------------------------------------------------------------------
create or replace function public.appraisal_review_group(p_template_type text, p_appraiser_hierarchy text)
returns text
language sql immutable set search_path = '' as $$
  select case
    when p_template_type = 'hr-to-all' or p_appraiser_hierarchy = 'hr' then 'hr'
    when p_template_type in ('leaders-to-members', 'executives-to-leaders') then 'manager'
    when p_template_type in ('members-to-members', 'leaders-to-leaders') then 'peers'
    when p_template_type = 'members-to-leaders' then 'team'
    else 'other'
  end
$$;

create or replace function public.period_employee_scores(p_period_id text)
returns table (review_period_id text, employee_id text, review_count integer, non_hr_count integer,
               overall_pct numeric, non_hr_pct numeric, hr_pct numeric, groups jsonb)
language sql stable security definer set search_path = '' as $$
  with w as (
    select coalesce((select hr_score_weight from public.settings order by key limit 1), 30)::numeric / 100 as hr_weight
  ),
  base as (
    select a.review_period_id, a.employee_id,
           public.appraisal_review_group(coalesce(a.template_snapshot ->> 'type', t.type), apr.hierarchy) as grp,
           a.score, a.max_score
    from public.appraisals a
    join public.employees apr on apr.id = a.appraiser_id
    left join public.templates t on t.id = a.template_id
    where a.completed_at is not null and a.max_score > 0
      and (p_period_id is null or a.review_period_id = p_period_id)
  ),
  g as (
    select review_period_id, employee_id, grp, count(*)::int as n, 100 * sum(score) / sum(max_score) as pct
    from base group by 1, 2, 3
  ),
  e as (
    select review_period_id, employee_id,
           sum(n)::int as review_count,
           coalesce(sum(n) filter (where grp <> 'hr'), 0)::int as non_hr_count,
           avg(pct) filter (where grp <> 'hr') as non_hr_pct,
           max(pct) filter (where grp = 'hr') as hr_pct,
           jsonb_object_agg(grp, jsonb_build_object('count', n, 'pct', round(pct, 2))) as groups
    from g group by 1, 2
  )
  select e.review_period_id, e.employee_id, e.review_count, e.non_hr_count,
         round(case when e.non_hr_pct is null then e.hr_pct
                    when e.hr_pct is null then e.non_hr_pct
                    else (1 - w.hr_weight) * e.non_hr_pct + w.hr_weight * e.hr_pct end, 2),
         round(e.non_hr_pct, 2), round(e.hr_pct, 2), e.groups
  from e cross join w
$$;
revoke all on function public.period_employee_scores(text) from public, anon, authenticated;

-- Rankings (admins). Members and leaders are ranked on separate boards; executives, HR, the
-- chairman and former employees are not ranked. A ranked person needs at least one non-HR review.
create or replace function public.get_period_rankings(p_period_id text default null)
returns table (review_period_id text, employee_id text, board text, eligible boolean, not_ranked_reason text,
               review_count integer, non_hr_count integer, overall_pct numeric, non_hr_pct numeric, hr_pct numeric,
               groups jsonb, rank integer)
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
    select sc.*, e.hierarchy, e.employment_status,
           case when e.hierarchy = 'member' then 'members'
                when e.hierarchy in ('leader', 'department-leader') then 'leaders' end as board
    from public.period_employee_scores(p_period_id) sc
    join public.employees e on e.id = sc.employee_id
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
  )
  select r.review_period_id, r.employee_id, r.board, r.reason is null, r.reason,
         r.review_count, r.non_hr_count, r.overall_pct, r.non_hr_pct, r.hr_pct, r.groups,
         case when r.reason is null
              then (rank() over (partition by r.review_period_id, r.board, r.reason is null order by r.overall_pct desc))::int
         end
  from r;
end
$$;
revoke all on function public.get_period_rankings(text) from public, anon;
grant execute on function public.get_period_rankings(text) to authenticated;

-- Awards per period and board. Choosing someone other than the board's #1 needs a reason.
create or replace function public.set_period_award(p_period_id text, p_board text, p_employee_id text, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  top_id text;
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.app_is_admin() then
    raise exception 'Only administrators can set awards.' using errcode = '42501';
  end if;
  if p_board not in ('members', 'leaders') then
    raise exception 'Unknown board.' using errcode = '22023';
  end if;
  if p_employee_id is null then
    update public.settings
    set period_awards = period_awards #- array[p_period_id, p_board], updated_at = now()
    where key = 'company';
    return;
  end if;

  if not exists (
    select 1 from public.get_period_rankings(p_period_id) r
    where r.board = p_board and r.eligible and r.employee_id = p_employee_id
  ) then
    raise exception 'That person is not ranked on this board for this period.' using errcode = '22023';
  end if;

  select r.employee_id into top_id
  from public.get_period_rankings(p_period_id) r
  where r.board = p_board and r.rank = 1
  order by r.overall_pct desc limit 1;
  if p_employee_id is distinct from top_id and clean_reason is null then
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

------------------------------------------------------------------------------
-- Staff see their own results only as summaries: no reviewer, no individual forms. Groups
-- (manager, peers, team) are shown only with 3+ reviewers so nobody can be singled out; the HR
-- review is an official company review and is always shown.
------------------------------------------------------------------------------
create or replace function public.get_my_results(p_employee_id text default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  target text := public.app_employee_id();
  result jsonb;
begin
  if p_employee_id is not null and p_employee_id is distinct from target then
    if not public.app_is_admin() then
      raise exception 'You can only see your own results.' using errcode = '42501';
    end if;
    target := p_employee_id;
  end if;
  if target is null then
    return '[]'::jsonb;
  end if;

  with mine as (
    select a.*, coalesce(a.template_snapshot, to_jsonb(t)) as tpl,
           public.appraisal_review_group(coalesce(a.template_snapshot ->> 'type', t.type), apr.hierarchy) as grp
    from public.appraisals a
    join public.employees apr on apr.id = a.appraiser_id
    left join public.templates t on t.id = a.template_id
    where a.employee_id = target and a.completed_at is not null and a.max_score > 0
  ),
  items as (
    select m.review_period_id, c ->> 'categoryName' as category, i ->> 'text' as item_text,
           i ->> 'categoryName' as item_label, coalesce((i ->> 'weight')::numeric, 0) as weight,
           (select (resp ->> 'value')::numeric
            from jsonb_array_elements(case when jsonb_typeof(m.responses) = 'array' then m.responses else '[]'::jsonb end) resp
            where resp ->> 'questionId' = i ->> 'id' and resp ->> 'value' ~ '^[1-5]$' limit 1) as rating
    from mine m,
         jsonb_array_elements(case when jsonb_typeof(m.tpl -> 'categories') = 'array' then m.tpl -> 'categories' else '[]'::jsonb end) c,
         jsonb_array_elements(case when jsonb_typeof(c -> 'items') = 'array' then c -> 'items' else '[]'::jsonb end) i
    where i ->> 'type' = 'rating-1-5'
  ),
  cats as (
    select review_period_id,
           jsonb_agg(jsonb_build_object('name', category, 'score', s, 'maxScore', mx) order by category) as categories
    from (select review_period_id, category, sum(rating * weight) as s, sum(5 * weight) as mx
          from items where rating is not null group by 1, 2) x
    group by 1
  ),
  qs as (
    select review_period_id,
           jsonb_agg(jsonb_build_object('name', name, 'total', total, 'max', mx)) as questions
    from (select review_period_id,
                 coalesce(nullif(category, '') || coalesce(': ' || nullif(item_label, ''), ''), item_text) as name,
                 sum(rating / 5 * weight) as total, sum(weight) as mx
          from items where rating is not null
          group by review_period_id, lower(left(item_text, 100)), 2) x
    group by 1
  ),
  hr as (
    select review_period_id, sum(score) as score, sum(max_score) as max_score
    from mine where grp = 'hr' group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'reviewPeriodId', sc.review_period_id,
           'reviewPeriodName', rp.name,
           'periodEndDate', rp.end_date,
           'reviewCount', sc.review_count,
           'overallPct', sc.overall_pct,
           'groups', (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(sc.groups) g(k, v)
                      where k <> 'hr' and (v ->> 'count')::int >= 3),
           'hr', case when hr.review_period_id is null then null
                      else jsonb_build_object('score', hr.score, 'maxScore', hr.max_score, 'pct', sc.hr_pct) end,
           'categories', coalesce(cats.categories, '[]'::jsonb),
           'questions', coalesce(qs.questions, '[]'::jsonb)
         ) order by rp.end_date desc nulls last), '[]'::jsonb)
  into result
  from public.period_employee_scores(null) sc
  left join public.review_periods rp on rp.id = sc.review_period_id
  left join cats on cats.review_period_id = sc.review_period_id
  left join qs on qs.review_period_id = sc.review_period_id
  left join hr on hr.review_period_id = sc.review_period_id
  where sc.employee_id = target;

  return result;
end
$$;
revoke all on function public.get_my_results(text) from public, anon;
grant execute on function public.get_my_results(text) to authenticated;

------------------------------------------------------------------------------
-- Staff can no longer read individual reviews about themselves (that exposed the reviewer);
-- they get summaries from get_my_results instead. They still see reviews they wrote.
------------------------------------------------------------------------------
drop policy if exists appraisals_read on public.appraisals;
create policy appraisals_read on public.appraisals for select to authenticated
  using ((select public.app_is_admin()) or appraiser_id = (select public.app_employee_id()));

-- The link form shows its deadline, so it needs the period end date (anonymous users cannot read periods).
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
      'expires_at', l.expires_at, 'used', submitted, 'created_at', l.created_at, 'token', l.token,
      'period_end_date', (select rp.end_date from public.review_periods rp where rp.id = l.review_period_id)),
    'template', case when t.id is null then null else to_jsonb(t) end,
    'employee', case when emp.id is null then null else jsonb_build_object('id', emp.id, 'name', emp.name, 'role', emp.role, 'hierarchy', emp.hierarchy) end,
    'appraiser', case when apr.id is null then null else jsonb_build_object('id', apr.id, 'name', apr.name, 'role', apr.role, 'hierarchy', apr.hierarchy) end
  );
end
$$;
