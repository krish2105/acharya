-- 0005_demo_artifact.sql
-- One seeded draft in demo_artifacts, for the approval card + outcome chip
-- to render against on first login (Phase 0 task 9).

insert into demo_artifacts (id, school_id, title, generated_version, status, created_by) values (
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Photosynthesis: worksheet note',
  '{"text": "Photosynthesis converts light energy into chemical energy stored in glucose."}'::jsonb,
  'draft',
  'd0000000-0000-0000-0000-000000000001'
);
