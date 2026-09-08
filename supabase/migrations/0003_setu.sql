-- 0003_setu.sql
-- SETU: the multi-board curriculum spine (Section 6.3). One concept graph,
-- four boards mapped onto it, humans confirming every link.

create table concepts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  subject_id uuid references subjects(id),
  title text not null,
  description text,
  stage text,                              -- 'preparatory','middle','secondary'
  parent_id uuid references concepts(id) on delete set null,
  embedding extensions.vector(384),
  created_at timestamptz not null default now()
);

create table learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  framework_id uuid not null references frameworks(id),
  subject_id uuid references subjects(id),
  grade text not null,
  ref_code text not null,
  statement text not null,
  cognitive_level text,                    -- Bloom
  source_document text,
  embedding extensions.vector(384),
  created_at timestamptz not null default now(),
  unique (school_id, framework_id, ref_code)
);

create table outcome_concepts (
  learning_outcome_id uuid not null references learning_outcomes(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  confidence numeric,
  method text not null check (method in ('embedding_suggested','llm_suggested','human_confirmed')),
  justification text,
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (learning_outcome_id, concept_id)
);
-- AI proposes. A human confirms. Only 'human_confirmed' links count for coverage and generation.
create function outcome_concepts_guard() returns trigger as $$
begin
  if new.method = 'human_confirmed' and (new.confirmed_by is null or new.confirmed_at is null) then
    raise exception 'human_confirmed links require confirmed_by and confirmed_at';
  end if;
  if new.method <> 'human_confirmed' then
    new.confirmed_by := null;
    new.confirmed_at := null;
  end if;
  return new;
end;
$$ language plpgsql;
create trigger outcome_concepts_guard before insert or update on outcome_concepts
  for each row execute function outcome_concepts_guard();

create table cross_alignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  outcome_a uuid not null references learning_outcomes(id) on delete cascade,
  outcome_b uuid not null references learning_outcomes(id) on delete cascade,
  similarity numeric,
  relation text check (relation in ('equivalent','partial','prerequisite','extends')),
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (outcome_a, outcome_b)
);

create table units (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  title text not null,
  subject_id uuid references subjects(id),
  grade text not null,
  framework_id uuid references frameworks(id),
  planned_hours numeric,
  sequence_no int,
  academic_year text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table unit_outcomes (
  unit_id uuid not null references units(id) on delete cascade,
  learning_outcome_id uuid not null references learning_outcomes(id) on delete cascade,
  primary key (unit_id, learning_outcome_id)
);

create table coverage (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  learning_outcome_id uuid not null references learning_outcomes(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  academic_year text not null,
  taught_on date,
  assessed_count int default 0,
  last_assessed_on date,
  created_at timestamptz not null default now(),
  unique (learning_outcome_id, section_id, academic_year)
);

create table transition_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id) on delete cascade,
  from_framework_id uuid not null references frameworks(id),
  to_framework_id uuid not null references frameworks(id),
  target_grade text not null,
  gaps jsonb not null,
  file_path text,
  generated_at timestamptz default now(),
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- indexes: every FK and RLS predicate column, plus HNSW on both embeddings
create index concepts_school_idx on concepts (school_id);
create index concepts_parent_idx on concepts (parent_id);
create index concepts_embedding_idx on concepts using hnsw (embedding extensions.vector_cosine_ops);
create index lo_school_fw_idx on learning_outcomes (school_id, framework_id, grade);
create index lo_subject_idx on learning_outcomes (subject_id);
create index lo_embedding_idx on learning_outcomes using hnsw (embedding extensions.vector_cosine_ops);
create index oc_concept_idx on outcome_concepts (concept_id);
create index oc_method_idx on outcome_concepts (method);
create index xa_school_idx on cross_alignments (school_id);
create index units_school_idx on units (school_id, academic_year);
create index uo_outcome_idx on unit_outcomes (learning_outcome_id);
create index coverage_section_idx on coverage (section_id, academic_year);
create index tr_student_idx on transition_reports (student_id);

-- RLS
alter table concepts enable row level security;
alter table learning_outcomes enable row level security;
alter table outcome_concepts enable row level security;
alter table cross_alignments enable row level security;
alter table units enable row level security;
alter table unit_outcomes enable row level security;
alter table coverage enable row level security;
alter table transition_reports enable row level security;

create policy concepts_tenant on concepts for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy lo_tenant on learning_outcomes for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy oc_tenant on outcome_concepts for all using (
  exists (select 1 from learning_outcomes lo where lo.id = outcome_concepts.learning_outcome_id
          and lo.school_id = (auth.jwt() ->> 'school_id')::uuid));
create policy xa_tenant on cross_alignments for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy units_tenant on units for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy uo_tenant on unit_outcomes for all using (
  exists (select 1 from units u where u.id = unit_outcomes.unit_id and u.school_id = (auth.jwt() ->> 'school_id')::uuid));
create policy coverage_tenant on coverage for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);
-- transition reports name a student: principals/academic heads, or teachers of that student's section
create policy tr_tenant on transition_reports for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and (
    (auth.jwt() ->> 'user_role') in ('principal','academic_head','board_coordinator')
    or student_id in (
      select st.id from students st
      join teaching_assignments ta on ta.section_id = st.section_id
      where ta.teacher_id = auth.uid())
  )
);

-- board_coordinator sees only their own framework's outcomes/alignments (Section 3)
create policy lo_board_coordinator_scope on learning_outcomes as restrictive for select using (
  (auth.jwt() ->> 'user_role') <> 'board_coordinator'
  or framework_id = (auth.jwt() ->> 'framework_id')::uuid
);

-- ---------------------------------------------------------------------------
-- Vector search helpers (called by the worker with the service role)
-- ---------------------------------------------------------------------------
create function match_concepts(p_school_id uuid, p_embedding extensions.vector(384), p_k int default 5)
returns table (concept_id uuid, title text, similarity numeric) language sql stable as $$
  select c.id, c.title, (1 - (c.embedding <=> p_embedding))::numeric
  from concepts c
  where c.school_id = p_school_id and c.embedding is not null
  order by c.embedding <=> p_embedding
  limit p_k
$$;

create function match_outcomes(p_school_id uuid, p_embedding extensions.vector(384), p_k int default 10, p_exclude uuid default null)
returns table (outcome_id uuid, ref_code text, statement text, framework_id uuid, similarity numeric) language sql stable as $$
  select lo.id, lo.ref_code, lo.statement, lo.framework_id, (1 - (lo.embedding <=> p_embedding))::numeric
  from learning_outcomes lo
  where lo.school_id = p_school_id and lo.embedding is not null and (p_exclude is null or lo.id <> p_exclude)
  order by lo.embedding <=> p_embedding
  limit p_k
$$;

-- Cross-alignment view: nearest outcomes in *other* frameworks (RLS-scoped; callable by users)
create function similar_outcomes(p_outcome_id uuid, p_k int default 6)
returns table (outcome_id uuid, ref_code text, statement text, framework_id uuid, framework_code text, grade text, similarity numeric)
language sql stable security invoker as $$
  select o.id, o.ref_code, o.statement, o.framework_id, f.code, o.grade, (1 - (o.embedding <=> src.embedding))::numeric
  from learning_outcomes src
  join learning_outcomes o on o.school_id = src.school_id and o.framework_id <> src.framework_id and o.embedding is not null
  join frameworks f on f.id = o.framework_id
  where src.id = p_outcome_id and src.embedding is not null
  order by o.embedding <=> src.embedding
  limit p_k
$$;

-- ---------------------------------------------------------------------------
-- Private storage buckets (Section 11): every object path is <school_id>/...
-- ---------------------------------------------------------------------------
create policy storage_tenant_read on storage.objects for select using (
  bucket_id in ('artifacts','papers','evidence','projects','cpd')
  and (storage.foldername(name))[1] = (auth.jwt() ->> 'school_id')
);
create policy storage_tenant_write on storage.objects for insert with check (
  bucket_id in ('artifacts','papers','evidence','projects','cpd')
  and (storage.foldername(name))[1] = (auth.jwt() ->> 'school_id')
);

-- ---------------------------------------------------------------------------
-- Effective coverage: an outcome is covered for a section if it has a direct
-- coverage row, OR a human_confirmed concept link to a concept that some
-- other directly-covered outcome also has a human_confirmed link to.
-- Suggested links (embedding/llm) never count -- Section 6.3 rule.
-- ---------------------------------------------------------------------------
create function effective_coverage(p_school_id uuid, p_section_id uuid, p_academic_year text)
returns table (learning_outcome_id uuid, taught_on date, assessed_count int, last_assessed_on date, via_outcome_id uuid)
language sql stable as $$
  with direct as (
    select c.learning_outcome_id, c.taught_on, c.assessed_count, c.last_assessed_on
    from coverage c
    where c.school_id = p_school_id and c.section_id = p_section_id and c.academic_year = p_academic_year
  ),
  confirmed as (
    select learning_outcome_id, concept_id from outcome_concepts where method = 'human_confirmed'
  ),
  inferred as (
    select distinct on (o2.learning_outcome_id)
      o2.learning_outcome_id, d.taught_on, d.assessed_count, d.last_assessed_on, d.learning_outcome_id as via
    from direct d
    join confirmed o1 on o1.learning_outcome_id = d.learning_outcome_id
    join confirmed o2 on o2.concept_id = o1.concept_id and o2.learning_outcome_id <> d.learning_outcome_id
    where not exists (select 1 from direct dd where dd.learning_outcome_id = o2.learning_outcome_id)
    order by o2.learning_outcome_id, d.taught_on desc nulls last
  )
  select learning_outcome_id, taught_on, assessed_count, last_assessed_on, null::uuid from direct
  union all
  select learning_outcome_id, taught_on, assessed_count, last_assessed_on, via from inferred
$$;

-- ---------------------------------------------------------------------------
-- Board transition gap report: target-framework outcomes at the target grade
-- with no confirmed covered equivalent in the student's previous framework.
-- ---------------------------------------------------------------------------
-- Only subjects the previous framework actually offers are comparable; the
-- rest are listed under not_comparable_subjects rather than counted as gaps.
create function compute_transition_gaps(p_school_id uuid, p_from_framework uuid, p_to_framework uuid, p_target_grade text)
returns jsonb language sql stable as $$
  with from_subjects as (
    select distinct subject_id from learning_outcomes
    where school_id = p_school_id and framework_id = p_from_framework and subject_id is not null
  ),
  target as (
    select lo.id, lo.ref_code, lo.statement, lo.subject_id
    from learning_outcomes lo
    where lo.school_id = p_school_id and lo.framework_id = p_to_framework and lo.grade = p_target_grade
  ),
  covered_concepts as (
    select distinct oc.concept_id
    from outcome_concepts oc
    join learning_outcomes lo on lo.id = oc.learning_outcome_id
    where oc.method = 'human_confirmed' and lo.school_id = p_school_id and lo.framework_id = p_from_framework
  ),
  gaps as (
    select t.id, t.ref_code, t.statement, s.name as subject
    from target t
    left join subjects s on s.id = t.subject_id
    where t.subject_id in (select subject_id from from_subjects)
      and not exists (
        select 1 from outcome_concepts oc
        where oc.learning_outcome_id = t.id and oc.method = 'human_confirmed'
          and oc.concept_id in (select concept_id from covered_concepts)
      )
    order by t.ref_code
  ),
  not_comparable as (
    select distinct s.name from target t join subjects s on s.id = t.subject_id
    where t.subject_id not in (select subject_id from from_subjects)
  )
  select jsonb_build_object(
    'gaps', coalesce((select jsonb_agg(jsonb_build_object('outcome_id', id, 'ref_code', ref_code, 'statement', statement, 'subject', subject)) from gaps), '[]'::jsonb),
    'compared_outcomes', (select count(*) from target where subject_id in (select subject_id from from_subjects)),
    'not_comparable_subjects', coalesce((select jsonb_agg(name order by name) from not_comparable), '[]'::jsonb)
  )
$$;
