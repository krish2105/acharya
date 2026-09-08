-- 0006_darpan.sql
-- DARPAN: the Holistic Progress Card engine (Section 6.6). Observations are
-- teacher-written, never system-inferred (rule 2.1.5). Descriptors are drafted
-- from redacted evidence and approved per domain; a report cannot generate
-- while any descriptor is unapproved (DB-enforced). super_admin can never read
-- report content or teacher-student notes (rule 2.1.3, RLS-enforced). Parents
-- see only their own child's released reports.

alter table students add column auth_user_id uuid references auth.users(id);
create index students_auth_user_idx on students (auth_user_id);

create table hpc_stages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  stage text not null check (stage in ('foundational','preparatory','middle','secondary')),
  grades text[] not null,
  template jsonb not null,                 -- stage-specific section structure
  created_at timestamptz not null default now(),
  unique (school_id, stage)
);

create table hpc_domains (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  stage text not null,
  domain text not null check (domain in ('cognitive','affective','socio_emotional','psychomotor')),
  descriptor_key text not null,
  label text not null,
  label_hi text,
  created_at timestamptz not null default now(),
  unique (school_id, stage, descriptor_key)
);

create table observations (                -- teacher-written, never system-inferred
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references profiles(id),
  domain text check (domain in ('cognitive','affective','socio_emotional','psychomotor')),
  context text,                            -- 'group work','presentation','lab','sport',...
  note text not null check (length(trim(note)) >= 3),
  learning_outcome_id uuid references learning_outcomes(id),
  observed_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table observation_evidence (        -- photos of project work, consent-checked
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  observation_id uuid not null references observations(id) on delete cascade,
  file_path text not null,
  consent_checked boolean not null default false,
  created_at timestamptz not null default now()
);

-- DPDP consent ledger (rule 13): versioned consent text per guardian per purpose
create table consent_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id) on delete cascade,
  guardian_id uuid references guardians(id) on delete set null,
  purpose text not null check (purpose in ('data_processing','parent_input','media_use','report_release')),
  consent_version text not null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  via text,                                -- 'portal','token_link','paper','admin'
  created_at timestamptz not null default now()
);
create index consent_student_idx on consent_records (student_id, purpose);

create function has_consent(p_student_id uuid, p_purpose text) returns boolean language sql stable as $$
  select exists (
    select 1 from consent_records c
    where c.student_id = p_student_id and c.purpose = p_purpose and c.granted and c.withdrawn_at is null
  )
$$;

-- media evidence requires media_use consent
create function observation_evidence_consent() returns trigger as $$
declare v_student uuid;
begin
  select student_id into v_student from observations where id = new.observation_id;
  if not has_consent(v_student, 'media_use') then
    raise exception 'media_use consent is required before attaching evidence for this student';
  end if;
  new.consent_checked := true;
  return new;
end;
$$ language plpgsql;
create trigger observation_evidence_consent_trg before insert on observation_evidence
  for each row execute function observation_evidence_consent();

create table hpc_inputs (                  -- the 360-degree part
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id) on delete cascade,
  term text not null,
  source text not null check (source in ('self','peer','parent','teacher')),
  submitted_by uuid,                       -- null for anonymised peer input (never exposed to students)
  submitted_by_student uuid references students(id) on delete set null,   -- peer: who wrote it (teacher-visible only)
  responses jsonb not null,
  language text not null default 'en',
  submitted_at timestamptz not null default now()
);
create index hpc_inputs_student_idx on hpc_inputs (student_id, term, source);

-- tokenised parent link (no login): one token per guardian per term
create table hpc_input_tokens (
  token uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  term text not null,
  expires_at timestamptz not null default now() + interval '21 days',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table hpc_descriptors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id) on delete cascade,
  term text not null,
  domain text not null check (domain in ('cognitive','affective','socio_emotional','psychomotor')),
  generated_text text,                     -- AI draft (prose)
  generated_json jsonb,                    -- {strengths, growth_areas, next_step}
  final_text text,                         -- teacher-approved
  status text not null default 'draft' check (status in ('draft','approved')),
  language text not null default 'en',
  generation_log_id bigint,
  drafted_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term, domain)
);
create index hpc_descriptors_student_idx on hpc_descriptors (student_id, term);
create trigger hpc_descriptors_approval_gate before insert or update on hpc_descriptors
  for each row execute function enforce_approval_gate('descriptor', 'approved');

create table hpc_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id) on delete cascade,
  term text not null,
  stage text not null,
  file_path text,
  generated_at timestamptz,
  generated_by uuid references profiles(id),
  released_to_parent_at timestamptz,
  released_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, term)
);

-- A report cannot generate while any domain descriptor is unapproved, and
-- every domain for the stage must have an approved descriptor.
create function hpc_reports_require_approved_descriptors() returns trigger as $$
declare
  v_unapproved int;
  v_missing int;
begin
  if new.generated_at is null and new.file_path is null then
    return new;                            -- placeholder row, nothing generated yet
  end if;
  select count(*) into v_unapproved from hpc_descriptors d
  where d.student_id = new.student_id and d.term = new.term and d.status <> 'approved';
  if v_unapproved > 0 then
    raise exception 'report for student % term % blocked: % descriptor(s) not yet approved', new.student_id, new.term, v_unapproved;
  end if;
  select count(distinct hd.domain) into v_missing from hpc_domains hd
  where hd.school_id = new.school_id and hd.stage = new.stage
    and not exists (select 1 from hpc_descriptors d where d.student_id = new.student_id and d.term = new.term and d.domain = hd.domain and d.status = 'approved');
  if v_missing > 0 then
    raise exception 'report for student % term % blocked: % domain(s) have no approved descriptor', new.student_id, new.term, v_missing;
  end if;
  return new;
end;
$$ language plpgsql;
create trigger hpc_reports_gate before insert or update on hpc_reports
  for each row execute function hpc_reports_require_approved_descriptors();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table hpc_stages enable row level security;
alter table hpc_domains enable row level security;
alter table observations enable row level security;
alter table observation_evidence enable row level security;
alter table consent_records enable row level security;
alter table hpc_inputs enable row level security;
alter table hpc_input_tokens enable row level security;
alter table hpc_descriptors enable row level security;
alter table hpc_reports enable row level security;

create policy hpc_stages_tenant on hpc_stages for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy hpc_domains_tenant on hpc_domains for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);

-- helpers (security definer, so policies never re-enter other tables' policies)
create function my_student_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select st.id from students st
  join teaching_assignments ta on ta.section_id = st.section_id
  where ta.teacher_id = auth.uid()
$$;
create function my_child_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select sg.student_id from student_guardians sg
  join guardians g on g.id = sg.guardian_id
  where g.auth_user_id = auth.uid()
$$;
create function my_own_student_id() returns setof uuid language sql stable security definer set search_path = public as $$
  select st.id from students st where st.auth_user_id = auth.uid()
$$;
create function my_classmate_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select s2.id from students s1 join students s2 on s2.section_id = s1.section_id where s1.auth_user_id = auth.uid()
$$;
create function my_guardian_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select g.id from guardians g where g.auth_user_id = auth.uid()
$$;

-- DARPAN: a teacher sees only students they teach; heads see all; super_admin never
create policy observation_scope on observations for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and (
    (auth.jwt() ->> 'user_role') in ('principal','academic_head')
    or student_id in (select my_student_ids())
  )
);
create policy observations_no_super_admin on observations as restrictive for all using ((auth.jwt() ->> 'user_role') <> 'super_admin');
create policy evidence_scope on observation_evidence for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and exists (select 1 from observations o where o.id = observation_evidence.observation_id)
);
create policy consent_scope on consent_records for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and (
    (auth.jwt() ->> 'user_role') in ('principal','academic_head')
    or student_id in (select my_student_ids())
    or guardian_id in (select my_guardian_ids())
  )
);

create policy hpc_inputs_staff on hpc_inputs for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and (
    (auth.jwt() ->> 'user_role') in ('principal','academic_head')
    or student_id in (select my_student_ids())
  )
);
-- a student sees/edits only their own self-assessment rows; peer feedback about
-- them is read through the anonymised view below, never from the base table
create policy hpc_inputs_student_self on hpc_inputs for all using (
  (auth.jwt() ->> 'user_role') = 'student' and source = 'self'
  and student_id in (select my_own_student_id())
);
-- a student may INSERT peer feedback about a classmate (same section)
create policy hpc_inputs_student_peer_insert on hpc_inputs for insert with check (
  (auth.jwt() ->> 'user_role') = 'student' and source = 'peer'
  and submitted_by_student in (select my_own_student_id())
  and student_id in (select my_classmate_ids())
);
-- a parent sees/edits only their own child's parent input
create policy hpc_inputs_parent on hpc_inputs for all using (
  (auth.jwt() ->> 'user_role') = 'parent' and source = 'parent'
  and student_id in (select my_child_ids())
);
create policy hpc_inputs_no_super_admin on hpc_inputs as restrictive for all using ((auth.jwt() ->> 'user_role') <> 'super_admin');

-- Peer input anonymised to the receiving student (Section 3)
create view hpc_peer_feedback_for_student with (security_invoker = false, security_barrier = true) as
  select i.id, i.student_id, i.term, i.responses, i.language, i.submitted_at
  from hpc_inputs i
  join students st on st.id = i.student_id
  where i.source = 'peer' and st.auth_user_id = auth.uid();
grant select on hpc_peer_feedback_for_student to authenticated;

create policy tokens_staff on hpc_input_tokens for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and ((auth.jwt() ->> 'user_role') in ('principal','academic_head') or student_id in (select my_student_ids()))
);

create policy descriptors_scope on hpc_descriptors for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and ((auth.jwt() ->> 'user_role') in ('principal','academic_head') or student_id in (select my_student_ids()))
);
create policy descriptors_no_super_admin on hpc_descriptors as restrictive for all using ((auth.jwt() ->> 'user_role') <> 'super_admin');

create policy reports_staff on hpc_reports for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and ((auth.jwt() ->> 'user_role') in ('principal','academic_head') or student_id in (select my_student_ids()))
);
-- parents see only their own child, and only released reports (Section 6.8)
create policy parent_report_scope on hpc_reports for select using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and released_to_parent_at is not null
  and student_id in (select my_child_ids())
);
create policy reports_no_super_admin on hpc_reports as restrictive for all using ((auth.jwt() ->> 'user_role') <> 'super_admin');

-- a parent may read their own child's row and a student their own
create policy students_parent_read on students for select using (
  id in (select my_child_ids()) or auth_user_id = auth.uid()
);

-- Class completion dashboard helper: per section, per student, how many domains remain
create function hpc_completion(p_school_id uuid, p_section_id uuid, p_term text)
returns table (student_id uuid, full_name text, stage text, domains int, approved int, drafted int, missing int, observations int, inputs int, report_generated boolean, released boolean)
language sql stable as $$
  with sec as (select s.grade from sections s where s.id = p_section_id),
  stg as (select hs.stage from hpc_stages hs, sec where hs.school_id = p_school_id and sec.grade = any(hs.grades) limit 1),
  dom as (select count(distinct hd.domain) as n from hpc_domains hd, stg where hd.school_id = p_school_id and hd.stage = stg.stage)
  select st.id, st.full_name, stg.stage, dom.n::int,
         (select count(*) from hpc_descriptors d where d.student_id = st.id and d.term = p_term and d.status = 'approved')::int,
         (select count(*) from hpc_descriptors d where d.student_id = st.id and d.term = p_term and d.status = 'draft')::int,
         (dom.n - (select count(*) from hpc_descriptors d where d.student_id = st.id and d.term = p_term))::int,
         (select count(*) from observations o where o.student_id = st.id)::int,
         (select count(*) from hpc_inputs i where i.student_id = st.id and i.term = p_term)::int,
         exists (select 1 from hpc_reports r where r.student_id = st.id and r.term = p_term and r.generated_at is not null),
         exists (select 1 from hpc_reports r where r.student_id = st.id and r.term = p_term and r.released_to_parent_at is not null)
  from students st, stg, dom
  where st.section_id = p_section_id and st.school_id = p_school_id and st.is_active
  order by 7 desc, 6 desc, st.full_name
$$;
