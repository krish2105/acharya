-- 0011_darpan.sql
-- DARPAN stage templates + domain descriptors for all four stages, the
-- descriptor prompt template, demo parent/student logins, consent records,
-- one term of observations and 360 inputs for a few Grade 6A students,
-- descriptors in mixed approval states (to demonstrate the report block), and
-- one released report.

-- descriptor template: redacted evidence in, strict-schema narrative out
insert into prompt_templates (key, version, system_prompt, user_template, output_schema, notes) values (
  'darpan.descriptor.v1', 1,
  'You draft Holistic Progress Card narratives for a class teacher, in {language_name}. You receive ONLY redacted evidence: teacher-written observations, outcome-linked assessment performance and 360-degree inputs. HARD PROHIBITIONS: never compare the child to other students, a class, an average or a rank; never diagnose, label a personality or use clinical terms; never predict future performance; never mention marks or names of any other student. Refer to the child only as [STUDENT_1]. Write specific, evidence-based, warm sentences. Respond with strict JSON only.',
  'Stage: {stage}. Term: {term}. Domain: {domain} ({domain_label}).
Evidence (redacted):
{evidence}

Draft the domain narrative: 2-3 specific strengths, 1-2 growth areas phrased as next steps, and one concrete next step for the coming term. Each sentence must trace to the evidence above.
Respond as JSON: {{"strengths":["..."],"growth_areas":["..."],"next_step":"..."}}',
  '{"type":"object","properties":{"strengths":{"type":"array","minItems":1,"maxItems":4,"items":{"type":"string","minLength":10}},"growth_areas":{"type":"array","minItems":1,"maxItems":3,"items":{"type":"string","minLength":10}},"next_step":{"type":"string","minLength":10}},"required":["strengths","growth_areas","next_step"],"additionalProperties":false}',
  'DARPAN descriptor drafting; post-validated for comparative/diagnostic/predictive language.'
);

-- stage templates (PARAKH / NCF-SE 2023 structure, synthetic wording)
insert into hpc_stages (school_id, stage, grades, template) values
  ('a0000000-0000-0000-0000-000000000001', 'foundational', array['Nursery','KG','1','2'],
   '{"sections":["all_about_me","learning_and_play","physical_development","social_emotional","teacher_note","parent_note"],"scholastic":false,"self_assessment":"pictorial"}'),
  ('a0000000-0000-0000-0000-000000000001', 'preparatory', array['3','4','5'],
   '{"sections":["scholastic","co_scholastic","personal_social","self_assessment","peer_feedback","parent_input","teacher_summary"],"scholastic":true,"self_assessment":"simple"}'),
  ('a0000000-0000-0000-0000-000000000001', 'middle', array['6','7','8'],
   '{"sections":["scholastic","co_scholastic","personal_social","self_assessment","peer_feedback","parent_input","teacher_summary","goals"],"scholastic":true,"self_assessment":"reflective"}'),
  ('a0000000-0000-0000-0000-000000000001', 'secondary', array['9','10','11','12'],
   '{"sections":["scholastic","co_scholastic","personal_social","self_assessment","peer_feedback","parent_input","teacher_summary","goals","career_interests"],"scholastic":true,"self_assessment":"reflective"}');

insert into hpc_domains (school_id, stage, domain, descriptor_key, label, label_hi)
select 'a0000000-0000-0000-0000-000000000001', s.stage, d.domain, d.key, d.label, d.label_hi
from (values ('foundational'), ('preparatory'), ('middle'), ('secondary')) as s(stage)
cross join (values
  ('cognitive', 'cognitive', 'Learning and understanding', 'सीखना और समझ'),
  ('affective', 'affective', 'Attitudes, values and interests', 'दृष्टिकोण, मूल्य और रुचियाँ'),
  ('socio_emotional', 'socio_emotional', 'Working with others', 'दूसरों के साथ काम करना'),
  ('psychomotor', 'psychomotor', 'Physical skills and creativity', 'शारीरिक कौशल और रचनात्मकता')
) as d(domain, key, label, label_hi);

-- demo parent + student logins (Section 9), linked to Grade 6A students 1 and 2
create or replace function seed_auth_user(p_id uuid, p_email text, p_password text) returns uuid as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email), 'email', now(), now());
  return p_id;
end;
$$ language plpgsql;

select seed_auth_user('d0000000-0000-0000-0000-000000000021', 'parent@kalanjali.demo', 'Demo@2026');
select seed_auth_user('d0000000-0000-0000-0000-000000000022', 'student@kalanjali.demo', 'Demo@2026');
select seed_auth_user('d0000000-0000-0000-0000-000000000023', 'principal@kalanjali.demo', 'Demo@2026');
select seed_auth_user('d0000000-0000-0000-0000-000000000024', 'super@acharya.demo', 'Demo@2026');
drop function seed_auth_user(uuid, text, text);

insert into profiles (id, school_id, full_name, role) values
  ('d0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', 'Suresh Sharma', 'parent'),
  ('d0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001', 'Diya Verma', 'student'),
  ('d0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000001', 'Kavita Rao', 'principal'),
  ('d0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000001', 'Platform Admin', 'super_admin');

-- link: parent user -> guardian of KAL-2026-0001; student user -> KAL-2026-0002
update guardians g set auth_user_id = 'd0000000-0000-0000-0000-000000000021'
from student_guardians sg join students st on st.id = sg.student_id
where sg.guardian_id = g.id and st.admission_no = 'KAL-2026-0001';
update students set auth_user_id = 'd0000000-0000-0000-0000-000000000022' where admission_no = 'KAL-2026-0002';

-- consent (rule 13): data processing + parent input for all 6A students; media_use for the first ten
insert into consent_records (school_id, student_id, guardian_id, purpose, consent_version, granted, via)
select st.school_id, st.id, sg.guardian_id, p.purpose, 'v1-2026', true, 'paper'
from students st join student_guardians sg on sg.student_id = st.id
cross join (values ('data_processing'), ('parent_input'), ('report_release')) as p(purpose)
where st.section_id = 'c0000000-0000-0000-0000-000000000001';
insert into consent_records (school_id, student_id, guardian_id, purpose, consent_version, granted, via)
select st.school_id, st.id, sg.guardian_id, 'media_use', 'v1-2026', true, 'portal'
from students st join student_guardians sg on sg.student_id = st.id
where st.section_id = 'c0000000-0000-0000-0000-000000000001' and st.admission_no <= 'KAL-2026-0010';

-- one term of teacher-written observations for the first 8 students of 6A
insert into observations (school_id, student_id, teacher_id, domain, context, note, learning_outcome_id, observed_on)
select st.school_id, st.id, 'd0000000-0000-0000-0000-000000000001', o.domain, o.context, o.note,
       case when o.domain = 'cognitive' then (select id from learning_outcomes where ref_code = 'CBSE.SCI.6.1.1' and school_id = st.school_id) else null end,
       current_date - o.days_ago
from students st
cross join (values
  ('cognitive', 'lab', 'Set up the seed-germination tray correctly and explained why the cotton had to stay moist.', 40),
  ('cognitive', 'group work', 'Drew a clear food chain on the board and corrected a peer''s arrow direction politely.', 32),
  ('affective', 'class discussion', 'Volunteered to present first even though visibly nervous; finished the whole explanation.', 27),
  ('socio_emotional', 'group work', 'Shared the microscope turn with a partner without being asked.', 21),
  ('psychomotor', 'sport', 'Completed the relay leg with a clean baton exchange; needs work on the starting stance.', 14),
  ('cognitive', 'presentation', 'Used the word "evidence" correctly when explaining why the plant near the window grew taller.', 7)
) as o(domain, context, note, days_ago)
where st.section_id = 'c0000000-0000-0000-0000-000000000001' and st.admission_no <= 'KAL-2026-0008';

-- 360 inputs for the first 8 students (self, one peer, parent, teacher)
insert into hpc_inputs (school_id, student_id, term, source, submitted_by, submitted_by_student, responses)
select st.school_id, st.id, 'T1 2026-27', 'self', null, st.id,
       '{"enjoy_most":"Science experiments","proud_of":"My germination tray","want_to_improve":"Asking questions when I am confused","help_needed":"More practice with fractions"}'
from students st where st.section_id = 'c0000000-0000-0000-0000-000000000001' and st.admission_no <= 'KAL-2026-0008';
insert into hpc_inputs (school_id, student_id, term, source, submitted_by, submitted_by_student, responses)
select st.school_id, st.id, 'T1 2026-27', 'peer', null,
       (select p.id from students p where p.section_id = st.section_id and p.id <> st.id order by p.admission_no limit 1),
       '{"good_at":"Explaining things clearly","kind_when":"Shared their notes when I was absent","could_try":"Letting others speak first in group work"}'
from students st where st.section_id = 'c0000000-0000-0000-0000-000000000001' and st.admission_no <= 'KAL-2026-0008';
insert into hpc_inputs (school_id, student_id, term, source, submitted_by, submitted_by_student, responses)
select st.school_id, st.id, 'T1 2026-27', 'parent', null, null,
       '{"at_home":"Reads for 20 minutes most evenings","interests":"Gardening, cricket","concerns":"Gets anxious before tests","support_wanted":"Tips for calm revision"}'
from students st where st.section_id = 'c0000000-0000-0000-0000-000000000001' and st.admission_no <= 'KAL-2026-0008';
insert into hpc_inputs (school_id, student_id, term, source, submitted_by, submitted_by_student, responses)
select st.school_id, st.id, 'T1 2026-27', 'teacher', 'd0000000-0000-0000-0000-000000000001', null,
       '{"participation":"Consistent","homework":"Mostly on time","collaboration":"Growing","note":"Benefits from a written checklist during practical work"}'
from students st where st.section_id = 'c0000000-0000-0000-0000-000000000001' and st.admission_no <= 'KAL-2026-0008';

-- descriptors: students 1-3 fully approved (4 domains), student 4 has 3 approved + 1 draft
-- (demonstrates the report block), students 5-8 untouched (completion dashboard).
insert into hpc_descriptors (id, school_id, student_id, term, domain, generated_text, generated_json, final_text, status, drafted_by)
select uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'acharya/darpan/desc/' || st.admission_no || '/' || d.domain),
       st.school_id, st.id, 'T1 2026-27', d.domain, d.txt,
       jsonb_build_object('strengths', array[d.txt], 'growth_areas', array['Continue building on this next term.'], 'next_step', 'Agree one small weekly goal with the class teacher.'),
       d.txt, 'draft', 'd0000000-0000-0000-0000-000000000001'
from students st
cross join (values
  ('cognitive', 'Sets up practical work carefully and explains observations using the correct terms; next term, aim to write the conclusion before discussing it with a partner.'),
  ('affective', 'Shows real willingness to try new things in class, including presenting first; keep noticing what helps when nerves appear.'),
  ('socio_emotional', 'Shares materials and takes turns without prompting; a next step is inviting quieter group members to contribute.'),
  ('psychomotor', 'Completes physical tasks with control and a clean technique; refine the starting position in running events.')
) as d(domain, txt)
where st.section_id = 'c0000000-0000-0000-0000-000000000001' and st.admission_no <= 'KAL-2026-0004';

create extension if not exists "uuid-ossp";

-- approvals + status transitions: all 4 domains for students 1-3, 3 of 4 for student 4
insert into approvals (school_id, artifact_type, artifact_id, generated_version, final_version, edit_distance, approved_by)
select d.school_id, 'descriptor', d.id, to_jsonb(d.generated_text), to_jsonb(d.final_text), 0, 'd0000000-0000-0000-0000-000000000001'
from hpc_descriptors d join students st on st.id = d.student_id
where st.admission_no <= 'KAL-2026-0003' or (st.admission_no = 'KAL-2026-0004' and d.domain <> 'psychomotor');
update hpc_descriptors d set status = 'approved', approved_by = 'd0000000-0000-0000-0000-000000000001', approved_at = now() - interval '5 days'
where exists (select 1 from approvals a where a.artifact_type = 'descriptor' and a.artifact_id = d.id);

-- one generated + released report (student 1) and one generated, unreleased (student 2)
insert into hpc_reports (school_id, student_id, term, stage, file_path, generated_at, generated_by, released_to_parent_at, released_by)
select st.school_id, st.id, 'T1 2026-27', 'middle', null, now() - interval '3 days', 'd0000000-0000-0000-0000-000000000001', now() - interval '2 days', 'd0000000-0000-0000-0000-000000000002'
from students st where st.admission_no = 'KAL-2026-0001';
insert into hpc_reports (school_id, student_id, term, stage, file_path, generated_at, generated_by)
select st.school_id, st.id, 'T1 2026-27', 'middle', null, now() - interval '1 day', 'd0000000-0000-0000-0000-000000000001'
from students st where st.admission_no = 'KAL-2026-0002';
