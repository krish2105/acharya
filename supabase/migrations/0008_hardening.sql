-- 0008_hardening.sql
-- Phase 6: performance indexes on every FK / RLS predicate column not yet
-- covered, the timetable behind "My Day", exam calendar events, the
-- notification queue (Resend digests), DPDP erasure requests, MFA-aware
-- policies for the highest-privilege roles, and the demo snapshot/reset.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists profiles_school_role_idx on profiles (school_id, role);
create index if not exists profiles_subject_idx on profiles (subject_id);
create index if not exists students_school_section_idx on students (school_id, section_id);
create index if not exists students_admission_idx on students (school_id, admission_no);
create index if not exists sections_school_idx on sections (school_id, grade);
create index if not exists sections_framework_idx on sections (framework_id);
create index if not exists ta_teacher_idx on teaching_assignments (teacher_id);
create index if not exists ta_section_idx on teaching_assignments (section_id);
create index if not exists ta_subject_idx on teaching_assignments (subject_id);
create index if not exists guardians_school_idx on guardians (school_id);
create index if not exists guardians_auth_idx on guardians (auth_user_id);
create index if not exists sg_guardian_idx on student_guardians (guardian_id);
create index if not exists subjects_school_idx on subjects (school_id);
create index if not exists generation_log_school_created_idx on generation_log (school_id, created_at desc);
create index if not exists audit_events_actor_idx on audit_events (actor_id);
create index if not exists audit_events_occurred_idx on audit_events (school_id, occurred_at desc);
create index if not exists approvals_school_idx on approvals (school_id, approved_at desc);
create index if not exists approvals_by_idx on approvals (approved_by);
create index if not exists demo_artifacts_school_idx on demo_artifacts (school_id, status);
create index if not exists lo_framework_idx on learning_outcomes (framework_id);
create index if not exists units_framework_idx on units (framework_id);
create index if not exists units_subject_idx on units (subject_id);
create index if not exists coverage_outcome_idx on coverage (learning_outcome_id);
create index if not exists items_subject_idx on items (subject_id);
create index if not exists papers_blueprint_idx on papers (blueprint_id);
create index if not exists responses_student_idx on responses (student_id);
create index if not exists artifacts_subject_idx on artifacts (subject_id);
create index if not exists artifacts_framework_idx on artifacts (framework_id);
create index if not exists observations_teacher_idx on observations (teacher_id);
create index if not exists observations_student_idx on observations (student_id, observed_on desc);
create index if not exists hpc_reports_student_idx on hpc_reports (student_id, term);
create index if not exists hpc_tokens_student_idx on hpc_input_tokens (student_id);
create index if not exists cpd_school_idx on cpd_records (school_id);


-- ---------------------------------------------------------------------------
-- Timetable ("My Day" period-aware dashboard, substitute packs)
-- ---------------------------------------------------------------------------
create table timetable_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  section_id uuid not null references sections(id) on delete cascade,
  subject_id uuid references subjects(id),
  teacher_id uuid not null references profiles(id) on delete cascade,
  weekday int not null check (weekday between 1 and 6),      -- 1 = Monday
  period_no int not null check (period_no between 1 and 10),
  starts_at time not null,
  ends_at time not null,
  academic_year text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, academic_year, weekday, period_no)
);
create index timetable_teacher_day_idx on timetable_periods (teacher_id, weekday, period_no);
alter table timetable_periods enable row level security;
create policy timetable_tenant on timetable_periods for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);

-- ---------------------------------------------------------------------------
-- Exam calendar (Class 10 two-exam planner). Papers already carry
-- scheduled_on / exam_kind / paired_with; this holds board-level dates and
-- correction windows that aren't tied to one paper.
-- ---------------------------------------------------------------------------
create table exam_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  title text not null,
  kind text not null check (kind in ('board_main','board_improvement','internal','correction_window','result')),
  grade text,
  framework_id uuid references frameworks(id),
  starts_on date not null,
  ends_on date,
  note text,
  created_at timestamptz not null default now()
);
create index exam_events_school_idx on exam_events (school_id, starts_on);
alter table exam_events enable row level security;
create policy exam_events_tenant on exam_events for all using (school_id = (auth.jwt() ->> 'school_id')::uuid and (auth.jwt() ->> 'user_role') not in ('parent','student'));

-- ---------------------------------------------------------------------------
-- Notification queue (Resend in production, Mailpit locally). pg_cron enqueues;
-- the worker's /notify/flush sends.
-- ---------------------------------------------------------------------------
create table notification_queue (
  id bigserial primary key,
  school_id uuid not null references schools(id),
  to_email text not null,
  subject text not null,
  body_text text not null,
  kind text not null,                      -- 'hod_digest','descriptor_reminder','exam_reminder','erasure'
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index nq_status_idx on notification_queue (status, created_at);
alter table notification_queue enable row level security;
create policy nq_admin_read on notification_queue for select using (school_id = (auth.jwt() ->> 'school_id')::uuid and (auth.jwt() ->> 'user_role') in ('principal','academic_head','super_admin'));

-- Weekly descriptor-completion reminders (Section 11 cron: 0 9 * * 1)
create function enqueue_descriptor_reminders() returns int language plpgsql security definer set search_path = public as $$
declare v int := 0;
begin
  insert into notification_queue (school_id, to_email, subject, body_text, kind)
  select p.school_id, u.email,
         'ACHARYA: ' || count(*) || ' HPC descriptor(s) still to approve',
         'You have ' || count(*) || ' draft descriptor(s) awaiting your approval for term T1 2026-27. Open DARPAN > Descriptors to finish them.',
         'descriptor_reminder'
  from hpc_descriptors d
  join students st on st.id = d.student_id
  join teaching_assignments ta on ta.section_id = st.section_id
  join profiles p on p.id = ta.teacher_id
  join auth.users u on u.id = p.id
  where d.status = 'draft'
  group by p.school_id, u.email;
  get diagnostics v = row_count;
  return v;
end;
$$;
select cron.schedule('descriptor-completion-reminders', '0 9 * * 1', $$select enqueue_descriptor_reminders()$$);

-- Daily HOD digest of pending items
create function enqueue_hod_digests() returns int language plpgsql security definer set search_path = public as $$
declare v int := 0;
begin
  insert into notification_queue (school_id, to_email, subject, body_text, kind)
  select p.school_id, u.email,
         'ACHARYA: ' || count(i.id) || ' item(s) awaiting HOD review',
         count(i.id) || ' item(s) in ' || coalesce(s.name, 'your subject') || ' are waiting for your review. Open PRASHNA > HOD review.',
         'hod_digest'
  from items i
  join profiles p on p.school_id = i.school_id and p.role = 'hod' and p.subject_id = i.subject_id
  join auth.users u on u.id = p.id
  left join subjects s on s.id = i.subject_id
  where i.status = 'pending_review'
  group by p.school_id, u.email, s.name;
  get diagnostics v = row_count;
  return v;
end;
$$;
select cron.schedule('hod-pending-digest', '0 8 * * *', $$select enqueue_hod_digests()$$);

-- Coverage refresh (Section 11: 0 3 * * *): assessed counts from responses
create function refresh_coverage_from_responses() returns int language plpgsql security definer set search_path = public as $$
declare v int := 0;
begin
  insert into coverage (school_id, learning_outcome_id, section_id, academic_year, assessed_count, last_assessed_on)
  select st.school_id, io.learning_outcome_id, st.section_id, '2026-27', count(distinct r.paper_id), max(r.created_at)::date
  from responses r
  join students st on st.id = r.student_id
  join item_outcomes io on io.item_id = r.item_id
  group by st.school_id, io.learning_outcome_id, st.section_id
  on conflict (learning_outcome_id, section_id, academic_year) do update
    set assessed_count = excluded.assessed_count, last_assessed_on = excluded.last_assessed_on;
  get diagnostics v = row_count;
  return v;
end;
$$;
select cron.schedule('coverage-refresh-nightly', '0 3 * * *', $$select refresh_coverage_from_responses()$$);

-- ---------------------------------------------------------------------------
-- DPDP: erasure requests and execution (data-subject rights)
-- ---------------------------------------------------------------------------
create table erasure_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id) on delete cascade,
  requested_by_guardian uuid references guardians(id) on delete set null,
  requested_by_profile uuid references profiles(id) on delete set null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed')),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_note text,
  executed_at timestamptz,
  requested_at timestamptz not null default now()
);
create index erasure_school_idx on erasure_requests (school_id, status);
alter table erasure_requests enable row level security;
create policy erasure_staff on erasure_requests for all using (
  school_id = (auth.jwt() ->> 'school_id')::uuid and (auth.jwt() ->> 'user_role') in ('principal','academic_head')
);
create policy erasure_parent on erasure_requests for select using (student_id in (select my_child_ids()));
create policy erasure_parent_insert on erasure_requests for insert with check (
  (auth.jwt() ->> 'user_role') = 'parent' and student_id in (select my_child_ids())
);

-- Executes an approved erasure: personal data removed or anonymised; aggregate
-- item statistics are already derived and retain no identity. Audit rows are
-- append-only and reference only ids.
create function execute_erasure(p_request_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare r erasure_requests%rowtype;
begin
  select * into r from erasure_requests where id = p_request_id;
  if r.status <> 'approved' then raise exception 'erasure request must be approved first'; end if;
  delete from observations where student_id = r.student_id;
  delete from hpc_inputs where student_id = r.student_id or submitted_by_student = r.student_id;
  delete from hpc_descriptors where student_id = r.student_id;
  delete from hpc_reports where student_id = r.student_id;
  delete from hpc_input_tokens where student_id = r.student_id;
  delete from responses where student_id = r.student_id;
  delete from ct_ai_projects where student_id = r.student_id;
  delete from transition_reports where student_id = r.student_id;
  delete from artifacts where student_id = r.student_id;
  update consent_records set withdrawn_at = now() where student_id = r.student_id and withdrawn_at is null;
  update students set full_name = 'Erased student', dob = date '1900-01-01', admission_no = 'ERASED-' || left(r.student_id::text, 8),
    is_active = false, auth_user_id = null, previous_framework_id = null where id = r.student_id;
  delete from guardians g where g.id in (select guardian_id from student_guardians where student_id = r.student_id)
    and not exists (select 1 from student_guardians sg2 where sg2.guardian_id = g.id and sg2.student_id <> r.student_id);
  update erasure_requests set status = 'executed', executed_at = now() where id = p_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- MFA: the highest-privilege roles must act at AAL2 once they have enrolled a
-- verified factor (enrolment is prompted on the Security page). Unenrolled
-- demo accounts keep working; enrolled accounts cannot bypass MFA by logging
-- in with only a password.
-- ---------------------------------------------------------------------------
create function mfa_enrolled(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.status = 'verified')
$$;
create function privileged_aal_ok() returns boolean language sql stable as $$
  select (auth.jwt() ->> 'user_role') not in ('principal','academic_head','super_admin')
      or not mfa_enrolled(auth.uid())
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;
create policy approvals_mfa on approvals as restrictive for insert with check (privileged_aal_ok());
create policy hpc_reports_mfa on hpc_reports as restrictive for update using (privileged_aal_ok());
create policy blueprints_mfa on blueprints as restrictive for all using (privileged_aal_ok());
create policy erasure_mfa on erasure_requests as restrictive for update using (privileged_aal_ok());
create policy profiles_mfa on profiles as restrictive for update using (privileged_aal_ok());

-- Session/device management: a user may list and revoke their own sessions
create view my_sessions with (security_invoker = false) as
  select s.id, s.created_at, s.updated_at, s.user_agent, s.ip, s.aal
  from auth.sessions s where s.user_id = auth.uid();
grant select on my_sessions to authenticated;
create function revoke_my_session(p_session_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.sessions where id = p_session_id and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Demo snapshot + reset (super_admin only, < 45 s). Tenant rows for the demo
-- school are copied into schema demo_snapshot after seeding; reset deletes the
-- live rows (children first) and reinserts them (parents first). Audit rows
-- are append-only and are deliberately kept.
-- ---------------------------------------------------------------------------
create schema if not exists demo_snapshot;

create function demo_tables() returns text[] language sql immutable as $$
  -- parent -> child order (school-scoped tables plus the join tables that hang off them)
  select array[
    'subjects','sections','profiles','school_frameworks','teaching_assignments','students','guardians','student_guardians',
    'generation_log',     -- parent of items/artifacts (generation_log_id)
    'prompt_templates_dummy',
    'concepts','learning_outcomes','outcome_concepts','cross_alignments','units','unit_outcomes','coverage','transition_reports',
    'approvals','demo_artifacts','items','item_outcomes','item_versions','blueprints','papers','paper_items','responses','item_stats',
    'artifacts','artifact_outcomes','artifact_versions','artifact_shares',
    'hpc_stages','hpc_domains','consent_records','observations','observation_evidence','hpc_inputs','hpc_input_tokens','hpc_descriptors','hpc_reports',
    'ct_ai_units','ct_ai_activities','ct_ai_hours_ledger','ct_ai_projects','cpd_records','ct_ai_hours_projections',
    'timetable_periods','exam_events','erasure_requests'
  ]
$$;

create function snapshot_demo(p_school_id uuid) returns int language plpgsql security definer set search_path = public as $$
declare t text; n int := 0; cond text;
begin
  foreach t in array demo_tables() loop
    if t = 'prompt_templates_dummy' then continue; end if;
    cond := case t
      when 'outcome_concepts' then format('learning_outcome_id in (select id from learning_outcomes where school_id = %L)', p_school_id)
      when 'unit_outcomes' then format('unit_id in (select id from units where school_id = %L)', p_school_id)
      when 'item_outcomes' then format('item_id in (select id from items where school_id = %L)', p_school_id)
      when 'paper_items' then format('paper_id in (select id from papers where school_id = %L)', p_school_id)
      when 'artifact_outcomes' then format('artifact_id in (select id from artifacts where school_id = %L)', p_school_id)
      when 'artifact_shares' then format('artifact_id in (select id from artifacts where school_id = %L)', p_school_id)
      when 'student_guardians' then format('student_id in (select id from students where school_id = %L)', p_school_id)
      when 'ct_ai_hours_projections' then format('section_id in (select id from sections where school_id = %L)', p_school_id)
      else format('school_id = %L', p_school_id) end;
    execute format('drop table if exists demo_snapshot.%I', t);
    execute format('create table demo_snapshot.%I as select * from public.%I where %s', t, t, cond);
    n := n + 1;
  end loop;
  return n;
end;
$$;

create function reset_demo(p_school_id uuid) returns int language plpgsql security definer set search_path = public as $$
declare
  tabs text[] := demo_tables();
  -- tenant structure profiles point at; unchanged by a demo, so never reset
  keep text[] := array['prompt_templates_dummy', 'profiles', 'subjects', 'sections', 'school_frameworks'];
  t text; n int := 0; cond text;
begin
  if (auth.jwt() ->> 'user_role') is not null and (auth.jwt() ->> 'user_role') <> 'super_admin' then
    raise exception 'reset_demo is super_admin only';
  end if;
  -- The snapshot is internally consistent: user triggers (approval gate,
  -- keep-last-link, version bumps) are switched off for the bulk delete +
  -- reinsert and back on afterwards; FK triggers stay on, hence the ordering.
  for i in 1..array_length(tabs, 1) loop
    t := tabs[i];
    if t = any (keep) then continue; end if;
    execute format('alter table public.%I disable trigger user', t);
  end loop;
  -- children first
  for i in reverse array_length(tabs, 1)..1 loop
    t := tabs[i];
    if t = any (keep) then continue; end if;
    cond := case t
      when 'outcome_concepts' then format('learning_outcome_id in (select id from learning_outcomes where school_id = %L)', p_school_id)
      when 'unit_outcomes' then format('unit_id in (select id from units where school_id = %L)', p_school_id)
      when 'item_outcomes' then format('item_id in (select id from items where school_id = %L)', p_school_id)
      when 'paper_items' then format('paper_id in (select id from papers where school_id = %L)', p_school_id)
      when 'artifact_outcomes' then format('artifact_id in (select id from artifacts where school_id = %L)', p_school_id)
      when 'artifact_shares' then format('artifact_id in (select id from artifacts where school_id = %L)', p_school_id)
      when 'student_guardians' then format('student_id in (select id from students where school_id = %L)', p_school_id)
      when 'ct_ai_hours_projections' then format('section_id in (select id from sections where school_id = %L)', p_school_id)
      else format('school_id = %L', p_school_id) end;
    execute format('delete from public.%I where %s', t, cond);
  end loop;
  -- then parents first
  for i in 1..array_length(tabs, 1) loop
    t := tabs[i];
    if t = any (keep) then continue; end if;
    execute format('insert into public.%I select * from demo_snapshot.%I', t, t);
    n := n + 1;
  end loop;
  for i in 1..array_length(tabs, 1) loop
    t := tabs[i];
    if t = any (keep) then continue; end if;
    execute format('alter table public.%I enable trigger user', t);
  end loop;
  return n;
end;
$$;
revoke all on function reset_demo(uuid) from public;
grant execute on function reset_demo(uuid) to authenticated, service_role;

-- Generated from pg_constraint: every remaining FK column gets a leading index.
create index if not exists artifact_shares_shared_by_fk_idx on artifact_shares (shared_by);
create index if not exists artifact_shares_shared_with_subject_fk_idx on artifact_shares (shared_with_subject);
create index if not exists artifact_versions_edited_by_fk_idx on artifact_versions (edited_by);
create index if not exists artifact_versions_school_id_fk_idx on artifact_versions (school_id);
create index if not exists artifacts_approved_by_fk_idx on artifacts (approved_by);
create index if not exists blueprints_framework_id_fk_idx on blueprints (framework_id);
create index if not exists blueprints_subject_id_fk_idx on blueprints (subject_id);
create index if not exists concepts_subject_id_fk_idx on concepts (subject_id);
create index if not exists consent_records_guardian_id_fk_idx on consent_records (guardian_id);
create index if not exists consent_records_school_id_fk_idx on consent_records (school_id);
create index if not exists coverage_school_id_fk_idx on coverage (school_id);
create index if not exists cross_alignments_confirmed_by_fk_idx on cross_alignments (confirmed_by);
create index if not exists cross_alignments_outcome_b_fk_idx on cross_alignments (outcome_b);
create index if not exists ct_ai_activities_school_id_fk_idx on ct_ai_activities (school_id);
create index if not exists ct_ai_hours_ledger_school_id_fk_idx on ct_ai_hours_ledger (school_id);
create index if not exists ct_ai_hours_ledger_teacher_id_fk_idx on ct_ai_hours_ledger (teacher_id);
create index if not exists ct_ai_projects_assessed_by_fk_idx on ct_ai_projects (assessed_by);
create index if not exists ct_ai_projects_school_id_fk_idx on ct_ai_projects (school_id);
create index if not exists demo_artifacts_created_by_fk_idx on demo_artifacts (created_by);
create index if not exists erasure_requests_decided_by_fk_idx on erasure_requests (decided_by);
create index if not exists erasure_requests_requested_by_guardian_fk_idx on erasure_requests (requested_by_guardian);
create index if not exists erasure_requests_requested_by_profile_fk_idx on erasure_requests (requested_by_profile);
create index if not exists erasure_requests_student_id_fk_idx on erasure_requests (student_id);
create index if not exists exam_events_framework_id_fk_idx on exam_events (framework_id);
create index if not exists hpc_descriptors_approved_by_fk_idx on hpc_descriptors (approved_by);
create index if not exists hpc_descriptors_drafted_by_fk_idx on hpc_descriptors (drafted_by);
create index if not exists hpc_descriptors_school_id_fk_idx on hpc_descriptors (school_id);
create index if not exists hpc_input_tokens_guardian_id_fk_idx on hpc_input_tokens (guardian_id);
create index if not exists hpc_input_tokens_school_id_fk_idx on hpc_input_tokens (school_id);
create index if not exists hpc_inputs_school_id_fk_idx on hpc_inputs (school_id);
create index if not exists hpc_inputs_submitted_by_student_fk_idx on hpc_inputs (submitted_by_student);
create index if not exists hpc_reports_generated_by_fk_idx on hpc_reports (generated_by);
create index if not exists hpc_reports_released_by_fk_idx on hpc_reports (released_by);
create index if not exists hpc_reports_school_id_fk_idx on hpc_reports (school_id);
create index if not exists item_versions_edited_by_fk_idx on item_versions (edited_by);
create index if not exists item_versions_school_id_fk_idx on item_versions (school_id);
create index if not exists items_approved_by_fk_idx on items (approved_by);
create index if not exists notification_queue_school_id_fk_idx on notification_queue (school_id);
create index if not exists observation_evidence_observation_id_fk_idx on observation_evidence (observation_id);
create index if not exists observation_evidence_school_id_fk_idx on observation_evidence (school_id);
create index if not exists observations_learning_outcome_id_fk_idx on observations (learning_outcome_id);
create index if not exists observations_school_id_fk_idx on observations (school_id);
create index if not exists outcome_concepts_confirmed_by_fk_idx on outcome_concepts (confirmed_by);
create index if not exists papers_approved_by_fk_idx on papers (approved_by);
create index if not exists papers_created_by_fk_idx on papers (created_by);
create index if not exists papers_paired_with_fk_idx on papers (paired_with);
create index if not exists profiles_framework_id_fk_idx on profiles (framework_id);
create index if not exists responses_school_id_fk_idx on responses (school_id);
create index if not exists school_frameworks_framework_id_fk_idx on school_frameworks (framework_id);
create index if not exists students_previous_framework_id_fk_idx on students (previous_framework_id);
create index if not exists students_section_id_fk_idx on students (section_id);
create index if not exists teaching_assignments_school_id_fk_idx on teaching_assignments (school_id);
create index if not exists timetable_periods_school_id_fk_idx on timetable_periods (school_id);
create index if not exists timetable_periods_section_id_fk_idx on timetable_periods (section_id);
create index if not exists timetable_periods_subject_id_fk_idx on timetable_periods (subject_id);
create index if not exists transition_reports_from_framework_id_fk_idx on transition_reports (from_framework_id);
create index if not exists transition_reports_reviewed_by_fk_idx on transition_reports (reviewed_by);
create index if not exists transition_reports_school_id_fk_idx on transition_reports (school_id);
create index if not exists transition_reports_to_framework_id_fk_idx on transition_reports (to_framework_id);
create index if not exists units_created_by_fk_idx on units (created_by);
