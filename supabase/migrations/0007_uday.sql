-- 0007_uday.sql
-- UDAY: the AI & Computational Thinking programme for Classes 3-8
-- (Section 6.7; CBSE Circular Acad-15/2026: 50 h/yr for Classes 3-5,
-- 100 h/yr for Classes 6-8). Hours ledger proves delivery; evidence pack
-- is inspection-ready.

create table ct_ai_units (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  grade text not null check (grade in ('3','4','5','6','7','8')),
  sequence_no int not null,
  title text not null,
  big_idea text,
  planned_hours numeric not null check (planned_hours > 0),
  strand text not null check (strand in ('computational_thinking','data_literacy','ai_concepts','ethics_and_bias','applied_project')),
  created_at timestamptz not null default now(),
  unique (school_id, grade, sequence_no)
);

create table ct_ai_activities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  unit_id uuid not null references ct_ai_units(id) on delete cascade,
  title text not null,
  mode text not null check (mode in ('unplugged','plugged','hybrid')),
  duration_minutes int not null check (duration_minutes > 0),
  materials text,
  instructions_md text not null,
  assessment_note text,
  created_at timestamptz not null default now()
);

create table ct_ai_hours_ledger (          -- proves the 50 / 100 hour requirement
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  section_id uuid not null references sections(id) on delete cascade,
  academic_year text not null,
  activity_id uuid references ct_ai_activities(id) on delete set null,
  delivered_on date not null,
  minutes int not null check (minutes > 0 and minutes <= 240),
  teacher_id uuid references profiles(id),
  evidence_path text,
  note text,
  created_at timestamptz not null default now()
);

create table ct_ai_projects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id) on delete cascade,
  unit_id uuid references ct_ai_units(id) on delete set null,
  title text,
  artefact_path text,
  rubric_scores jsonb,                     -- teacher-entered per criterion; never auto-graded
  teacher_comment text,
  assessed_by uuid references profiles(id),
  assessed_on date,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table cpd_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  teacher_id uuid not null references profiles(id) on delete cascade,
  activity text not null,                  -- 'District Level Deliberation','CBSE CoE workshop','in-house'
  theme text not null default 'Computational Thinking and Understanding AI',
  hours numeric not null check (hours > 0),
  completed_on date,
  certificate_path text,
  created_at timestamptz not null default now()
);

create table ct_ai_hours_projections (     -- weekly pg_cron snapshot
  section_id uuid not null references sections(id) on delete cascade,
  academic_year text not null,
  computed_on date not null,
  delivered_hours numeric not null,
  required_hours numeric not null,
  projected_hours numeric not null,
  projected_shortfall numeric not null,
  primary key (section_id, academic_year, computed_on)
);

create index ct_units_school_grade_idx on ct_ai_units (school_id, grade);
create index ct_activities_unit_idx on ct_ai_activities (unit_id);
create index ct_ledger_section_idx on ct_ai_hours_ledger (section_id, academic_year);
create index ct_ledger_activity_idx on ct_ai_hours_ledger (activity_id);
create index ct_projects_student_idx on ct_ai_projects (student_id);
create index ct_projects_unit_idx on ct_ai_projects (unit_id);
create index cpd_teacher_idx on cpd_records (teacher_id);

-- Every unit must keep at least one unplugged activity so the programme runs
-- without a lab (Phase 5 acceptance test). Enforced on delete/update of activities.
create function ct_ai_unit_keeps_unplugged() returns trigger as $$
declare v_unit uuid := coalesce(old.unit_id, new.unit_id);
begin
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.mode <> 'unplugged') then
    if old.mode = 'unplugged' and not exists (
      select 1 from ct_ai_activities a where a.unit_id = v_unit and a.mode = 'unplugged' and a.id <> old.id
    ) then
      raise exception 'unit % must keep at least one unplugged activity', v_unit;
    end if;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;
create trigger ct_ai_unit_keeps_unplugged_trg before update or delete on ct_ai_activities
  for each row execute function ct_ai_unit_keeps_unplugged();

-- RLS (Section 3: ct_ai_lead full; principal/academic_head full; teachers own
-- classes; hod/board_coordinator/exam_officer read; students own projects; parents none)
alter table ct_ai_units enable row level security;
alter table ct_ai_activities enable row level security;
alter table ct_ai_hours_ledger enable row level security;
alter table ct_ai_projects enable row level security;
alter table cpd_records enable row level security;
alter table ct_ai_hours_projections enable row level security;

create policy ct_units_read on ct_ai_units for select using (school_id = (auth.jwt() ->> 'school_id')::uuid and (auth.jwt() ->> 'user_role') <> 'parent');
create policy ct_units_write on ct_ai_units for all using (school_id = (auth.jwt() ->> 'school_id')::uuid and (auth.jwt() ->> 'user_role') in ('ct_ai_lead','principal','academic_head','super_admin'));
create policy ct_activities_read on ct_ai_activities for select using (school_id = (auth.jwt() ->> 'school_id')::uuid and (auth.jwt() ->> 'user_role') <> 'parent');
create policy ct_activities_write on ct_ai_activities for all using (school_id = (auth.jwt() ->> 'school_id')::uuid and (auth.jwt() ->> 'user_role') in ('ct_ai_lead','principal','academic_head','super_admin'));
create policy ct_ledger_read on ct_ai_hours_ledger for select using (school_id = (auth.jwt() ->> 'school_id')::uuid and (auth.jwt() ->> 'user_role') not in ('parent','student'));
create policy ct_ledger_write on ct_ai_hours_ledger for insert with check (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and ((auth.jwt() ->> 'user_role') in ('ct_ai_lead','principal','academic_head')
       or section_id in (select ta.section_id from teaching_assignments ta where ta.teacher_id = auth.uid()))
);
create policy ct_projects_staff on ct_ai_projects for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and ((auth.jwt() ->> 'user_role') in ('ct_ai_lead','principal','academic_head')
       or student_id in (select my_student_ids()))
);
create policy ct_projects_student on ct_ai_projects for all using (student_id in (select my_own_student_id()));
create policy cpd_read on cpd_records for select using (school_id = (auth.jwt() ->> 'school_id')::uuid and ((auth.jwt() ->> 'user_role') in ('ct_ai_lead','principal','academic_head','hod') or teacher_id = auth.uid()));
create policy cpd_write on cpd_records for all using (school_id = (auth.jwt() ->> 'school_id')::uuid and ((auth.jwt() ->> 'user_role') in ('ct_ai_lead','principal','academic_head') or teacher_id = auth.uid()));
create policy projections_read on ct_ai_hours_projections for select using (exists (select 1 from sections s where s.id = ct_ai_hours_projections.section_id and s.school_id = (auth.jwt() ->> 'school_id')::uuid));

-- ---------------------------------------------------------------------------
-- Hours dashboard: delivered vs required, projected shortfall (Phase 5 task 5)
-- Academic year runs April to March; projection assumes the current pace.
-- ---------------------------------------------------------------------------
create function uday_required_hours(p_grade text) returns numeric language sql immutable as $$
  select case when p_grade in ('3','4','5') then 50 when p_grade in ('6','7','8') then 100 else 0 end
$$;

create function uday_hours_dashboard(p_school_id uuid, p_academic_year text, p_as_of date default current_date)
returns table (section_id uuid, grade text, section text, required_hours numeric, delivered_hours numeric, shortfall numeric,
               weeks_elapsed numeric, weeks_total numeric, projected_hours numeric, projected_shortfall numeric, sessions int, last_delivered date)
language sql stable as $$
  with yr as (
    select make_date((split_part(p_academic_year, '-', 1))::int, 4, 1) as start_on,
           make_date((split_part(p_academic_year, '-', 1))::int + 1, 3, 31) as end_on
  ),
  weeks as (
    select greatest(1, least(36, ceil((least(p_as_of, end_on) - start_on) / 7.0))) as elapsed, 36::numeric as total from yr
  ),
  led as (
    select l.section_id, sum(l.minutes) / 60.0 as delivered, count(*) as sessions, max(l.delivered_on) as last_on
    from ct_ai_hours_ledger l where l.school_id = p_school_id and l.academic_year = p_academic_year
    group by l.section_id
  )
  select s.id, s.grade, s.section, uday_required_hours(s.grade),
         round(coalesce(led.delivered, 0), 1),
         round(uday_required_hours(s.grade) - coalesce(led.delivered, 0), 1),
         weeks.elapsed, weeks.total,
         round(coalesce(led.delivered, 0) / weeks.elapsed * weeks.total, 1),
         round(greatest(0, uday_required_hours(s.grade) - coalesce(led.delivered, 0) / weeks.elapsed * weeks.total), 1),
         coalesce(led.sessions, 0)::int, led.last_on
  from sections s
  left join led on led.section_id = s.id
  cross join weeks
  where s.school_id = p_school_id and s.grade in ('3','4','5','6','7','8')
  order by s.grade, s.section
$$;

create function refresh_uday_projections() returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into ct_ai_hours_projections (section_id, academic_year, computed_on, delivered_hours, required_hours, projected_hours, projected_shortfall)
  select d.section_id, '2026-27', current_date, d.delivered_hours, d.required_hours, d.projected_hours, d.projected_shortfall
  from schools sc, lateral uday_hours_dashboard(sc.id, '2026-27') d
  on conflict (section_id, academic_year, computed_on) do update set delivered_hours = excluded.delivered_hours,
    projected_hours = excluded.projected_hours, projected_shortfall = excluded.projected_shortfall;
  get diagnostics v = row_count;
  return v;
end;
$$;
select cron.schedule('uday-hours-projection-weekly', '0 4 * * 1', $$select refresh_uday_projections()$$);
