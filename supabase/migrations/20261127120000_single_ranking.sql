------------------------------------------------------------------------------
-- One ranking per period. Members and leaders are ranked together and there is a single
-- award per period, stored under period_awards[period]['overall']. The board column stays as
-- a label (member or leader). Earlier members/leaders awards are kept as they are.
------------------------------------------------------------------------------

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
              then (rank() over (partition by r.review_period_id, r.reason is null order by r.overall_pct desc))::int
         end
  from r;
end
$$;
revoke all on function public.get_period_rankings(text) from public, anon;
grant execute on function public.get_period_rankings(text) to authenticated;

-- The single award for a period. Only 'overall' can be set; anyone tied for #1 needs no reason.
create or replace function public.set_period_award(p_period_id text, p_board text, p_employee_id text, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  chosen_rank integer;
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.app_is_admin() then
    raise exception 'Only administrators can set awards.' using errcode = '42501';
  end if;
  if p_board is distinct from 'overall' then
    raise exception 'Unknown award.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.review_periods where id = p_period_id) then
    raise exception 'That review period does not exist.' using errcode = '22023';
  end if;
  if length(clean_reason) > 500 then
    raise exception 'Please keep the reason under 500 characters.' using errcode = '22023';
  end if;

  if p_employee_id is null then
    update public.settings
    set period_awards = period_awards #- array[p_period_id, 'overall'], updated_at = now()
    where key = 'company';
    return;
  end if;

  select r.rank into chosen_rank
  from public.get_period_rankings(p_period_id) r
  where r.eligible and r.employee_id = p_employee_id;
  if not found then
    raise exception 'That person is not ranked for this period.' using errcode = '22023';
  end if;
  if chosen_rank <> 1 and clean_reason is null then
    raise exception 'Please give a reason for choosing someone other than the top-ranked person.' using errcode = '22023';
  end if;

  update public.settings
  set period_awards = jsonb_set(
        case when period_awards ? p_period_id then period_awards
             else period_awards || jsonb_build_object(p_period_id, '{}'::jsonb) end,
        array[p_period_id, 'overall'],
        jsonb_build_object('employeeId', p_employee_id, 'reason', clean_reason,
                           'setBy', public.app_user_id(), 'setAt', now())),
      updated_at = now()
  where key = 'company';
end
$$;
revoke all on function public.set_period_award(text, text, text, text) from public, anon;
grant execute on function public.set_period_award(text, text, text, text) to authenticated;

-- Carry an earlier award over when a period had exactly one (members or leaders). Periods with
-- both keep them for an admin to choose from; nothing is removed.
update public.settings s
set period_awards = (
      select jsonb_object_agg(
               p.key,
               case
                 when p.value ? 'overall' then p.value
                 when (p.value ? 'members') <> (p.value ? 'leaders') then
                   p.value || jsonb_build_object('overall',
                     coalesce(p.value -> 'members', p.value -> 'leaders')
                       || jsonb_build_object('migratedFrom', case when p.value ? 'members' then 'members' else 'leaders' end))
                 else p.value
               end)
      from jsonb_each(s.period_awards) p
    ),
    updated_at = now()
where s.period_awards is not null
  and jsonb_typeof(s.period_awards) = 'object'
  and s.period_awards <> '{}'::jsonb;
