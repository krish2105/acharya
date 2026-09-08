# Data model

Postgres 17 on Supabase (`ap-south-1`). Every table below has RLS enabled and at
least one policy (verified by `web/tests/hardening.test.ts`); every FK column is
indexed (same test). Migrations are in `supabase/migrations/`.

## Tenancy & identity — `0001_tenancy.sql`
`schools`, `frameworks`, `school_frameworks`, `profiles` (role, framework_id,
subject_id), `subjects`, `sections`, `students`, `guardians`,
`student_guardians`, `teaching_assignments`. JWT claims injected by
`custom_access_token_hook`: `school_id`, `user_role`, `framework_id`,
`subject_id`. Security-definer helpers (`my_student_ids`, `my_child_ids`,
`my_own_student_id`, `my_classmate_ids`, `my_guardian_ids`) keep student/guardian
policies non-recursive.

## Audit, gateway, approval — `0002_audit_gateway_approval.sql`
- `audit_events` — insert-only, per-tenant hash chain; `verify_chain(school_id)`.
- `prompt_templates` (versioned, JSON schema per template), `generation_log`
  (prompt **hash** only, provider, latency, validation result, redaction count).
- `approvals` — the ledger: `artifact_type`, `artifact_id`, generated and final
  versions, `edit_distance`, `approved_by/at`. `enforce_approval_gate()` is
  attached to every artifact table; a status transition into
  approved/shared/printed/released without a ledger row is rejected by Postgres.

## SETU — `0003_setu.sql`
`concepts`, `learning_outcomes` (+ `embedding vector(384)`), `outcome_concepts`,
`cross_alignments`, `units`, `unit_outcomes`, `coverage`, `transition_reports`.

## PRASHNA — `0004_prashna.sql`
`items` (type, marks, cognitive level, intended/actual difficulty,
discrimination, `parts`), `item_outcomes` (≥1 enforced), `item_versions`,
`blueprints` (composition JSON: competency share, difficulty, cognitive mix),
`papers` (exam_kind, scheduled_on, `paired_with` for the Class 10 improvement
exam, files JSON), `paper_items`, `responses`, `item_stats`. pg_cron 02:00
recalibrates difficulty/discrimination from responses.

## SAARTHI — `0005_saarthi.sql`
`artifacts` (kind ∈ lesson_plan, worksheet, rubric, parent_message, activity,
remediation_set, revision_sheet; language; body + generated_version),
`artifact_outcomes` (≥1 enforced), `artifact_versions`, `artifact_shares`.
RPCs `create_artifact` / `update_artifact` wrap the deferred link constraint.

## DARPAN — `0006_darpan.sql`
`hpc_stages`, `hpc_domains`, `consent_records` (purpose × version × granted /
withdrawn), `observations` (teacher-written only), `observation_evidence`,
`hpc_inputs` (self / peer / parent / teacher; peer anonymised via
`hpc_peer_feedback_for_student`), `hpc_input_tokens` (parent link),
`hpc_descriptors`, `hpc_reports` (release to parent). Restrictive policies
deny `super_admin` all DARPAN content.

## UDAY — `0007_uday.sql`
`ct_ai_units` (unplugged / digital / applied_project strands),
`ct_ai_activities` (≥1 unplugged per unit enforced), `ct_ai_hours_ledger`,
`ct_ai_projects` (rubric scores, teacher comment — no AI scoring),
`cpd_records`, `ct_ai_hours_projections` (pg_cron Mondays 04:00).

## Hardening — `0008_hardening.sql`
`timetable_periods` (My Day, substitute packs), `exam_events`,
`notification_queue` (pg_cron enqueues 08:00 HOD digests and Monday 09:00
descriptor reminders; the worker flushes via Resend/SMTP), `erasure_requests` +
`execute_erasure()` (DPDP), `mfa_enrolled()` / `privileged_aal_ok()` restrictive
policies (principal / academic_head / super_admin must be at AAL2 once
enrolled), `my_sessions` view + `revoke_my_session()`, `snapshot_demo()` /
`reset_demo()` (schema `demo_snapshot`, < 45 s).

## What is deliberately absent
No column, view or API for: AI-detection scores, risk scores, learner-type
labels, predicted grades, engagement/behaviour telemetry. `grep -ri
"detect\|risk_score\|predict" supabase/migrations` returns only the guardrails
that reject such language.
