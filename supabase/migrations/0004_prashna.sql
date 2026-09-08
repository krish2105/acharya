-- 0004_prashna.sql
-- PRASHNA: competency item bank, blueprints, papers, responses, calibration
-- (Section 6.4). Every item ties to >= 1 outcome (DB-enforced); nothing
-- reaches 'approved' without an approvals row (DB-enforced).

create type item_type as enum (
  'mcq','assertion_reason','case_based','source_based','short_answer','long_answer',
  'numerical','diagram','competency_cluster'
);

create table items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  subject_id uuid references subjects(id),
  framework_id uuid references frameworks(id),
  grade text not null,
  item_type item_type not null,
  stem text not null,
  stimulus text,
  options jsonb,
  parts jsonb,                              -- sub-questions for case/source/cluster items
  answer_key jsonb not null,
  marking_scheme text,
  marks numeric not null check (marks > 0),
  cognitive_level text not null check (cognitive_level in ('remember','understand','apply','analyse','evaluate','create')),
  difficulty_intended text check (difficulty_intended in ('easy','medium','hard')),
  origin text not null check (origin in ('ai_generated','teacher_written','imported')),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','retired')),
  review_note text,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  generation_log_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table item_outcomes (
  item_id uuid not null references items(id) on delete cascade,
  learning_outcome_id uuid not null references learning_outcomes(id),
  primary key (item_id, learning_outcome_id)
);

create table item_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  item_id uuid not null references items(id) on delete cascade,
  version int not null,
  body jsonb not null,
  edited_by uuid references profiles(id),
  edited_at timestamptz not null default now(),
  unique (item_id, version)
);

create table blueprints (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  framework_id uuid references frameworks(id),
  subject_id uuid references subjects(id),
  grade text not null,
  label text not null,
  total_marks numeric not null,
  duration_minutes int,
  composition jsonb not null,
  is_active boolean default true,
  created_at timestamptz not null default now()
);

create table papers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  blueprint_id uuid references blueprints(id),
  section_id uuid references sections(id),
  title text not null,
  exam_kind text check (exam_kind in ('unit_test','midterm','preboard','main_board_practice','improvement_practice','mock')),
  scheduled_on date,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','printed')),
  compliance jsonb,
  shortfalls jsonb,
  files jsonb not null default '{}',       -- {question, key, scheme, compliance} -> storage paths
  paired_with uuid references papers(id),
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table paper_items (
  paper_id uuid not null references papers(id) on delete cascade,
  item_id uuid not null references items(id),
  section_label text,
  q_no text,
  marks numeric,
  primary key (paper_id, item_id)
);

create table responses (
  id bigserial primary key,
  school_id uuid not null references schools(id),
  paper_id uuid references papers(id) on delete cascade,
  item_id uuid references items(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  marks_obtained numeric not null,
  max_marks numeric not null,
  created_at timestamptz not null default now(),
  unique (paper_id, item_id, student_id)
);

create table item_stats (
  item_id uuid primary key references items(id) on delete cascade,
  school_id uuid not null references schools(id),
  attempts int,
  facility numeric,
  discrimination numeric,
  difficulty_observed text,
  flagged boolean default false,
  last_computed_on date
);

-- indexes
create index items_school_status_idx on items (school_id, status);
create index items_bank_idx on items (school_id, subject_id, grade, item_type, status);
create index items_framework_idx on items (framework_id);
create index items_created_by_idx on items (created_by);
create index io_outcome_idx on item_outcomes (learning_outcome_id);
create index iv_item_idx on item_versions (item_id);
create index blueprints_school_idx on blueprints (school_id, framework_id, subject_id, grade);
create index papers_school_idx on papers (school_id, status);
create index papers_section_idx on papers (section_id);
create index pi_item_idx on paper_items (item_id);
create index responses_item_idx on responses (item_id);
create index responses_paper_idx on responses (paper_id, student_id);
create index item_stats_school_idx on item_stats (school_id, flagged);

-- ---------------------------------------------------------------------------
-- Mandatory outcome linkage (rule 14): an item cannot exist with zero
-- item_outcomes rows. Deferred constraint trigger, so a transaction that
-- inserts the item and its links together passes; a bare insert fails at
-- commit. Removing the last link is rejected outright.
-- ---------------------------------------------------------------------------
create function items_require_outcome() returns trigger as $$
begin
  if not exists (select 1 from item_outcomes where item_id = new.id) then
    raise exception 'item % must link to at least one learning outcome', new.id;
  end if;
  return null;
end;
$$ language plpgsql;

create constraint trigger items_require_outcome_trg
  after insert or update on items
  deferrable initially deferred
  for each row execute function items_require_outcome();

create function item_outcomes_keep_last() returns trigger as $$
begin
  if exists (select 1 from items where id = old.item_id)
     and not exists (select 1 from item_outcomes where item_id = old.item_id and learning_outcome_id <> old.learning_outcome_id) then
    raise exception 'item % must keep at least one learning outcome', old.item_id;
  end if;
  return old;
end;
$$ language plpgsql;

create trigger item_outcomes_keep_last_trg
  before delete on item_outcomes
  for each row execute function item_outcomes_keep_last();

-- Atomic create: item + links + version 1 in one transaction (what the app uses).
create function create_item(p_item jsonb, p_outcome_ids uuid[]) returns uuid
language plpgsql security invoker as $$
declare
  v_id uuid;
  v_school uuid := (p_item ->> 'school_id')::uuid;
begin
  if p_outcome_ids is null or array_length(p_outcome_ids, 1) is null then
    raise exception 'an item must link to at least one learning outcome';
  end if;
  insert into items (id, school_id, subject_id, framework_id, grade, item_type, stem, stimulus, options, parts, answer_key,
                     marking_scheme, marks, cognitive_level, difficulty_intended, origin, status, created_by, generation_log_id)
  values (coalesce((p_item ->> 'id')::uuid, gen_random_uuid()),
          v_school, (p_item ->> 'subject_id')::uuid, (p_item ->> 'framework_id')::uuid, p_item ->> 'grade',
          (p_item ->> 'item_type')::item_type, p_item ->> 'stem', p_item ->> 'stimulus', p_item -> 'options', p_item -> 'parts', p_item -> 'answer_key',
          p_item ->> 'marking_scheme', (p_item ->> 'marks')::numeric, p_item ->> 'cognitive_level', p_item ->> 'difficulty_intended',
          coalesce(p_item ->> 'origin', 'teacher_written'), coalesce(p_item ->> 'status', 'draft'), (p_item ->> 'created_by')::uuid,
          (p_item ->> 'generation_log_id')::bigint)
  returning id into v_id;
  insert into item_outcomes (item_id, learning_outcome_id) select v_id, unnest(p_outcome_ids);
  insert into item_versions (school_id, item_id, version, body, edited_by)
  values (v_school, v_id, 1, p_item - 'id' - 'school_id' - 'created_by' - 'generation_log_id', (p_item ->> 'created_by')::uuid);
  return v_id;
end;
$$;

-- Edit = new version row + update; keeps generated vs edited history (rule 17)
create function update_item(p_item_id uuid, p_patch jsonb, p_outcome_ids uuid[], p_editor uuid) returns int
language plpgsql security invoker as $$
declare
  v_next int;
  v_school uuid;
begin
  update items set
    stem = coalesce(p_patch ->> 'stem', stem),
    stimulus = coalesce(p_patch ->> 'stimulus', stimulus),
    options = coalesce(p_patch -> 'options', options),
    parts = coalesce(p_patch -> 'parts', parts),
    answer_key = coalesce(p_patch -> 'answer_key', answer_key),
    marking_scheme = coalesce(p_patch ->> 'marking_scheme', marking_scheme),
    marks = coalesce((p_patch ->> 'marks')::numeric, marks),
    cognitive_level = coalesce(p_patch ->> 'cognitive_level', cognitive_level),
    difficulty_intended = coalesce(p_patch ->> 'difficulty_intended', difficulty_intended),
    updated_at = now()
  where id = p_item_id
  returning school_id into v_school;
  if v_school is null then raise exception 'item not found'; end if;

  if p_outcome_ids is not null and array_length(p_outcome_ids, 1) is not null then
    delete from item_outcomes where item_id = p_item_id and not (learning_outcome_id = any(p_outcome_ids));
    insert into item_outcomes (item_id, learning_outcome_id)
      select p_item_id, unnest(p_outcome_ids) on conflict do nothing;
  end if;

  select coalesce(max(version), 0) + 1 into v_next from item_versions where item_id = p_item_id;
  insert into item_versions (school_id, item_id, version, body, edited_by)
  select v_school, p_item_id, v_next,
         jsonb_build_object('stem', stem, 'stimulus', stimulus, 'options', options, 'parts', parts, 'answer_key', answer_key,
                            'marking_scheme', marking_scheme, 'marks', marks, 'cognitive_level', cognitive_level,
                            'difficulty_intended', difficulty_intended),
         p_editor
  from items where id = p_item_id;
  return v_next;
end;
$$;

-- Approval gates (rule 2.1.4), reusing the Phase 0 function
create trigger items_approval_gate before insert or update on items
  for each row execute function enforce_approval_gate('item', 'approved');
create trigger papers_approval_gate before insert or update on papers
  for each row execute function enforce_approval_gate('paper', 'approved,printed');

-- ---------------------------------------------------------------------------
-- RLS (Section 6.8 pattern; app role claim is `user_role`)
-- ---------------------------------------------------------------------------
alter table items enable row level security;
alter table item_outcomes enable row level security;
alter table item_versions enable row level security;
alter table blueprints enable row level security;
alter table papers enable row level security;
alter table paper_items enable row level security;
alter table responses enable row level security;
alter table item_stats enable row level security;

create policy items_tenant_write on items for insert with check (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy items_tenant_update on items for update using (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy items_tenant_delete on items for delete using (school_id = (auth.jwt() ->> 'school_id')::uuid and created_by = auth.uid() and status = 'draft');
create policy item_visibility on items for select using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and (
    status = 'approved'                                        -- shared bank
    or created_by = auth.uid()                                 -- own drafts
    or (auth.jwt() ->> 'user_role') in ('principal','academic_head','exam_officer','board_coordinator')
    or ((auth.jwt() ->> 'user_role') = 'hod' and subject_id = (auth.jwt() ->> 'subject_id')::uuid)
  )
);
-- board_coordinator: own framework only
create policy items_board_scope on items as restrictive for select using (
  (auth.jwt() ->> 'user_role') <> 'board_coordinator' or framework_id = (auth.jwt() ->> 'framework_id')::uuid
);

create policy io_tenant on item_outcomes for all using (
  exists (select 1 from items i where i.id = item_outcomes.item_id and i.school_id = (auth.jwt() ->> 'school_id')::uuid));
create policy iv_tenant on item_versions for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy blueprints_tenant on blueprints for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy papers_tenant on papers for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy pi_tenant on paper_items for all using (
  exists (select 1 from papers p where p.id = paper_items.paper_id and p.school_id = (auth.jwt() ->> 'school_id')::uuid));
-- responses name a student: heads, exam officers, HODs and the student's teachers
create policy responses_tenant on responses for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and (
    (auth.jwt() ->> 'user_role') in ('principal','academic_head','exam_officer','hod')
    or student_id in (select st.id from students st join teaching_assignments ta on ta.section_id = st.section_id where ta.teacher_id = auth.uid())
  )
);
create policy item_stats_tenant on item_stats for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);

-- ---------------------------------------------------------------------------
-- Difficulty calibration (Phase 2 task 11): facility and discrimination per
-- item from real response data; flags items whose observed difficulty
-- differs from their label. Scheduled nightly on pg_cron.
-- ---------------------------------------------------------------------------
create function run_item_calibration(p_school_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  with scored as (
    select r.item_id, r.student_id, r.paper_id,
           (r.marks_obtained / nullif(r.max_marks, 0)) as prop,
           (r.marks_obtained >= r.max_marks) as full_marks,
           sum(r.marks_obtained) over (partition by r.paper_id, r.student_id) as student_total
    from responses r
    where r.school_id = p_school_id
  ),
  ranked as (
    select *, ntile(3) over (partition by paper_id order by student_total desc) as tercile
    from scored
  ),
  agg as (
    select item_id,
           count(*) as attempts,
           avg(case when full_marks then 1.0 else 0.0 end) as facility,
           avg(prop) filter (where tercile = 1) - avg(prop) filter (where tercile = 3) as discrimination
    from ranked
    group by item_id
    having count(*) >= 10
  )
  insert into item_stats (item_id, school_id, attempts, facility, discrimination, difficulty_observed, flagged, last_computed_on)
  select a.item_id, p_school_id, a.attempts, round(a.facility, 3), round(coalesce(a.discrimination, 0), 3),
         case when a.facility >= 0.7 then 'easy' when a.facility >= 0.4 then 'medium' else 'hard' end,
         (case when a.facility >= 0.7 then 'easy' when a.facility >= 0.4 then 'medium' else 'hard' end) is distinct from i.difficulty_intended,
         current_date
  from agg a join items i on i.id = a.item_id
  on conflict (item_id) do update set
    attempts = excluded.attempts, facility = excluded.facility, discrimination = excluded.discrimination,
    difficulty_observed = excluded.difficulty_observed, flagged = excluded.flagged, last_computed_on = excluded.last_computed_on;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('item-calibration-nightly', '0 2 * * *', $$select run_item_calibration(id) from schools$$);
