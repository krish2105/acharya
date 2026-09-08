-- 0005_saarthi.sql
-- SAARTHI: the sanctioned teacher copilot (Section 6.5). Every artifact is
-- outcome-linked (DB-enforced), approval-gated (DB-enforced), and keeps the
-- generated version next to the teacher's edits (rule 17).

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  kind text not null check (kind in ('lesson_plan','worksheet','rubric','parent_message','activity','remediation_set','revision_sheet')),
  title text not null,
  body jsonb not null,                      -- current (teacher-edited) version
  generated_version jsonb,                  -- what the model produced, untouched
  subject_id uuid references subjects(id),
  grade text,
  framework_id uuid references frameworks(id),
  unit_id uuid references units(id) on delete set null,
  section_id uuid references sections(id) on delete set null,
  student_id uuid references students(id) on delete set null,   -- parent messages only
  differentiation_level text check (differentiation_level in ('support','core','extension')),
  language text not null default 'en' check (language in ('en','hi')),
  origin text not null check (origin in ('ai_generated','teacher_written')),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','shared')),
  review_note text,
  file_path text,
  generation_log_id bigint,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table artifact_outcomes (
  artifact_id uuid not null references artifacts(id) on delete cascade,
  learning_outcome_id uuid not null references learning_outcomes(id),
  primary key (artifact_id, learning_outcome_id)
);

create table artifact_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  version int not null,
  body jsonb not null,
  edited_by uuid references profiles(id),
  edited_at timestamptz not null default now(),
  unique (artifact_id, version)
);

create table artifact_shares (
  artifact_id uuid not null references artifacts(id) on delete cascade,
  shared_with_role app_role not null,
  shared_with_subject uuid references subjects(id),
  shared_by uuid references profiles(id),
  shared_at timestamptz not null default now(),
  primary key (artifact_id, shared_with_role)
);

create index artifacts_school_idx on artifacts (school_id, kind, status);
create index artifacts_creator_idx on artifacts (created_by);
create index artifacts_unit_idx on artifacts (unit_id);
create index artifacts_section_idx on artifacts (section_id);
create index artifacts_student_idx on artifacts (student_id);
create index ao_outcome_idx on artifact_outcomes (learning_outcome_id);
create index av_artifact_idx on artifact_versions (artifact_id);

-- mandatory outcome linkage (rule 14), same pattern as items
create function artifacts_require_outcome() returns trigger as $$
begin
  if not exists (select 1 from artifact_outcomes where artifact_id = new.id) then
    raise exception 'artifact % must link to at least one learning outcome', new.id;
  end if;
  return null;
end;
$$ language plpgsql;
create constraint trigger artifacts_require_outcome_trg after insert or update on artifacts
  deferrable initially deferred for each row execute function artifacts_require_outcome();

create function artifact_outcomes_keep_last() returns trigger as $$
begin
  if exists (select 1 from artifacts where id = old.artifact_id)
     and not exists (select 1 from artifact_outcomes where artifact_id = old.artifact_id and learning_outcome_id <> old.learning_outcome_id) then
    raise exception 'artifact % must keep at least one learning outcome', old.artifact_id;
  end if;
  return old;
end;
$$ language plpgsql;
create trigger artifact_outcomes_keep_last_trg before delete on artifact_outcomes
  for each row execute function artifact_outcomes_keep_last();

-- approval gate (rule 2.1.4): approved/shared need an approvals row
create trigger artifacts_approval_gate before insert or update on artifacts
  for each row execute function enforce_approval_gate('artifact', 'approved,shared');

create function create_artifact(p_artifact jsonb, p_outcome_ids uuid[]) returns uuid
language plpgsql security invoker as $$
declare
  v_id uuid;
  v_school uuid := (p_artifact ->> 'school_id')::uuid;
begin
  if p_outcome_ids is null or array_length(p_outcome_ids, 1) is null then
    raise exception 'an artifact must link to at least one learning outcome';
  end if;
  insert into artifacts (id, school_id, kind, title, body, generated_version, subject_id, grade, framework_id, unit_id, section_id, student_id,
                         differentiation_level, language, origin, status, generation_log_id, created_by)
  values (coalesce((p_artifact ->> 'id')::uuid, gen_random_uuid()), v_school, p_artifact ->> 'kind', p_artifact ->> 'title',
          p_artifact -> 'body', p_artifact -> 'generated_version', (p_artifact ->> 'subject_id')::uuid, p_artifact ->> 'grade',
          (p_artifact ->> 'framework_id')::uuid, (p_artifact ->> 'unit_id')::uuid, (p_artifact ->> 'section_id')::uuid,
          (p_artifact ->> 'student_id')::uuid, p_artifact ->> 'differentiation_level', coalesce(p_artifact ->> 'language', 'en'),
          coalesce(p_artifact ->> 'origin', 'teacher_written'), 'draft', (p_artifact ->> 'generation_log_id')::bigint,
          (p_artifact ->> 'created_by')::uuid)
  returning id into v_id;
  insert into artifact_outcomes (artifact_id, learning_outcome_id) select v_id, unnest(p_outcome_ids);
  insert into artifact_versions (school_id, artifact_id, version, body, edited_by)
  values (v_school, v_id, 1, p_artifact -> 'body', (p_artifact ->> 'created_by')::uuid);
  return v_id;
end;
$$;

create function update_artifact(p_artifact_id uuid, p_body jsonb, p_title text, p_editor uuid) returns int
language plpgsql security invoker as $$
declare
  v_next int;
  v_school uuid;
begin
  update artifacts set body = p_body, title = coalesce(p_title, title), updated_at = now()
  where id = p_artifact_id returning school_id into v_school;
  if v_school is null then raise exception 'artifact not found'; end if;
  select coalesce(max(version), 0) + 1 into v_next from artifact_versions where artifact_id = p_artifact_id;
  insert into artifact_versions (school_id, artifact_id, version, body, edited_by) values (v_school, p_artifact_id, v_next, p_body, p_editor);
  return v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: teachers see their own artifacts and anything shared with their role
-- or subject; HODs their subject; heads everything (Section 3).
-- ---------------------------------------------------------------------------
alter table artifacts enable row level security;
alter table artifact_outcomes enable row level security;
alter table artifact_versions enable row level security;
alter table artifact_shares enable row level security;

create policy artifacts_insert on artifacts for insert with check (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy artifacts_update on artifacts for update using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and (created_by = auth.uid() or (auth.jwt() ->> 'user_role') in ('principal','academic_head')
       or ((auth.jwt() ->> 'user_role') = 'hod' and subject_id = (auth.jwt() ->> 'subject_id')::uuid))
);
create policy artifacts_delete on artifacts for delete using (school_id = (auth.jwt() ->> 'school_id')::uuid and created_by = auth.uid() and status = 'draft');
-- security definer so the artifacts policy can consult shares without
-- re-entering the artifact_shares policy (which itself looks at artifacts).
create function artifact_shared_with_me(p_artifact_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from artifact_shares s
    where s.artifact_id = p_artifact_id
      and s.shared_with_role = (auth.jwt() ->> 'user_role')::app_role
      and (s.shared_with_subject is null or s.shared_with_subject = (auth.jwt() ->> 'subject_id')::uuid
           or exists (select 1 from teaching_assignments ta where ta.teacher_id = auth.uid() and ta.subject_id = s.shared_with_subject))
  )
$$;

create policy artifacts_select on artifacts for select using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and (
    created_by = auth.uid()
    or (auth.jwt() ->> 'user_role') in ('principal','academic_head','board_coordinator')
    or ((auth.jwt() ->> 'user_role') = 'hod' and subject_id = (auth.jwt() ->> 'subject_id')::uuid)
    or artifact_shared_with_me(artifacts.id)
  )
);
create policy artifacts_board_scope on artifacts as restrictive for select using (
  (auth.jwt() ->> 'user_role') <> 'board_coordinator' or framework_id = (auth.jwt() ->> 'framework_id')::uuid
);
create policy ao_tenant on artifact_outcomes for all using (
  exists (select 1 from artifacts a where a.id = artifact_outcomes.artifact_id and a.school_id = (auth.jwt() ->> 'school_id')::uuid));
create policy av_tenant on artifact_versions for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);
create policy shares_tenant on artifact_shares for all using (
  exists (select 1 from artifacts a where a.id = artifact_shares.artifact_id and a.school_id = (auth.jwt() ->> 'school_id')::uuid));

-- ---------------------------------------------------------------------------
-- "My time saved" (Phase 3 task 10): per teacher and per department. Minutes
-- per kind are conservative estimates of what a teacher would spend writing
-- from scratch; reuse = shares of approved artifacts.
-- ---------------------------------------------------------------------------
create function time_saved_summary(p_school_id uuid)
returns table (subject_id uuid, subject text, teacher_id uuid, teacher text, approved int, drafts_reused int, avg_edit_distance numeric, hours_saved numeric)
language sql stable as $$
  with minutes as (
    select * from (values ('lesson_plan', 45), ('worksheet', 40), ('rubric', 30), ('parent_message', 10),
                          ('activity', 25), ('remediation_set', 60), ('revision_sheet', 40)) as m(kind, minutes)
  ),
  base as (
    select a.subject_id, s.name as subject, a.created_by as teacher_id, p.full_name as teacher, a.kind, a.id,
           (select count(*) from artifact_shares sh where sh.artifact_id = a.id) as shares,
           ap.edit_distance
    from artifacts a
    left join subjects s on s.id = a.subject_id
    left join profiles p on p.id = a.created_by
    left join approvals ap on ap.artifact_type = 'artifact' and ap.artifact_id = a.id
    where a.school_id = p_school_id and a.status in ('approved', 'shared')
  )
  select b.subject_id, b.subject, b.teacher_id, b.teacher,
         count(*)::int as approved,
         coalesce(sum(b.shares), 0)::int as drafts_reused,
         round(avg(b.edit_distance), 1) as avg_edit_distance,
         round(sum(m.minutes) / 60.0, 1) as hours_saved
  from base b join minutes m on m.kind = b.kind
  group by b.subject_id, b.subject, b.teacher_id, b.teacher
  order by hours_saved desc
$$;
