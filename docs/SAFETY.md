# Safety

ACHARYA generates **aligned drafts, never decisions.** This document is the
refusals list: what the product will not do, and why -- a sales document as
much as a dev note. Everything below is enforced in the database or the
worker and covered by a test named in `PROGRESS.md`.

## What ACHARYA refuses to do

- **AI never assigns a final grade.** No auto-submit path exists in the
  codebase, in any phase.
- **No AI-detection score on student work.** Not in any schema, API, import
  or UI, ever. Detectors misfire on weaker and non-native writers; an
  accusation against a child is disproportionate.
- **No student profiling or prediction.** No risk scores, no learner-type
  labels, no dropout or performance prediction. Mastery is expressed per
  learning outcome, teacher-facing, never as a label attached to a child.
- **No behaviour or engagement surveillance.** DARPAN observations (Phase 4)
  are things a teacher deliberately wrote down, never system-inferred.
- **Aggregate views suppress cells below 5.**
- If a feature request sounds like "grade it automatically", "detect if a
  student used AI", or "tell us which students are weak" -- the answer is no.
  The aligned alternative: draft feedback for teacher approval; declared-use
  and process evidence; per-outcome mastery for the teacher, never a label on
  a child.

## What's enforced

- **Nothing AI-generated reaches a student without explicit human approval.**
  `enforce_approval_gate()` blocks any artifact from entering an
  `approved`/`published`/`printed`/`assigned`/`shared` status without a
  matching `approvals` row. This is a Postgres trigger, not an application
  check -- verified by attempting to bypass it directly in SQL (see
  `PROGRESS.md`).
- **No student personal data leaves the system boundary into any model.**
  Every inference call passes through the AI gateway
  (`docs/AI-GATEWAY.md`), which redacts name, admission number, phone, email
  and DOB from the constructed prompt before any provider sees it. Verified
  against all 50 seeded students.
- **Row Level Security on every table containing personal or tenant data.**
  A table without a policy is a build failure (rule 11).
- **Synthetic data only.** No real student, teacher or school data has been
  used at any point in this build. The demo tenant is the fictional
  "Kalanjali International School, Jaipur" (5,400 students, CBSE + IB DP +
  Cambridge, per Section 9) -- never a real school.
- **Insert-only, hash-chained audit log.** Every `audit_events` row is
  chained to the previous one for its tenant; `UPDATE`/`DELETE` are rejected
  unconditionally by trigger, and `verify_chain()` detects tampering that
  bypasses even that (see `docs/ARCHITECTURE.md`).

## Enforced by later phases (all built)

- `super_admin` can never read DARPAN report content or teacher-student notes
  in any tenant: restrictive RLS policies on `observations`, `hpc_inputs`,
  `hpc_descriptors`, `hpc_reports` (migration `0006`), plus the `can()` matrix.
- Peer input is anonymised to the receiving student (`hpc_peer_feedback_for_student`
  view); the teacher sees the author.
- Every item and artifact links to >= 1 learning outcome in a named framework
  -- deferred constraint triggers reject zero-link saves and the removal of
  the last link (`0004`, `0005`; tested).
- Only `human_confirmed` alignments count for coverage, generation and
  transition reports. Models propose; people confirm.
- Descriptor and parent-message drafting rejects comparative, diagnostic,
  predictive and personality language (English and Hindi patterns) after
  schema validation -- the teacher never sees the offending draft.
- Remediation sets are bank-first: existing approved items before any
  generation.
- Project assessment in UDAY is rubric scores and a teacher comment; there is
  no AI scoring path.
- Substitute packs, evidence packs and progress cards include approved
  material only.

## Data protection

- Data residency: Supabase region `ap-south-1` (Mumbai); see `docs/DEPLOY.md`.
- Every student under 18 is a child under the DPDP Act 2023. Consent is
  recorded per purpose and version (`consent_records`) and shown to parents.
- Right of access and right to erasure are implemented end to end
  (`/consent`, parent portal, `execute_erasure()`); see `docs/SECURITY.md`.
- Prompts are never stored -- only their hash -- and zero personal spans reach
  any model (tested over every seeded student).
