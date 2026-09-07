# Safety (v1, Phase 0)

ACHARYA generates **aligned drafts, never decisions.** This document is the
refusals list: what the product will not do, and why -- a sales document as
much as a dev note (Section 8, Phase 6). This v1 covers what Phase 0 already
enforces at the database level, plus the full set of standing refusals every
later phase must hold to.

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

## What's enforced in the database today (Phase 0)

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

## What's designed but not yet built

These are non-negotiable for the phases that introduce them, not yet
applicable because the relevant tables don't exist:

- `super_admin` may never read DARPAN report content or teacher-student notes
  in any tenant (rule 2.1.3; enforced in RLS once DARPAN's tables exist,
  Phase 4). `web/lib/rbac`'s permission matrix already encodes this exclusion
  for UI gating.
- Peer input in DARPAN is anonymised to the receiving student, visible in
  full only to the teacher (Phase 4).
- Every generated item/artifact must link to at least one learning outcome in
  a named framework, enforced by a DB trigger rejecting zero-link saves
  (Phases 1-3).
- Descriptor drafting (DARPAN) rejects comparative, diagnostic or predictive
  language via post-validation (Phase 4).

## Data protection

- Data residency: Supabase region `ap-south-1` (Mumbai) -- a Phase 6
  deployment concern; Phase 0 runs entirely local.
- Every student under 18 is a child under DPDP; parent-facing consent records
  are captured for DARPAN parent inputs and any media use (Phase 4).
