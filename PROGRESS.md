# PROGRESS

## Status: Phases 0–6 built and verified locally — deploy pending credentials

Every phase of the master document (Sections 8, Phases 0–6) is built against the
real local stack (Supabase Postgres via `supabase start`, FastAPI worker, Ollama
`llama3.1:8b`), with the acceptance tests below passing from a clean
`supabase db reset`. The only outstanding step is the live deployment
(Vercel `bom1` + Render Singapore + Supabase `ap-south-1`), which needs
credentials the owner will paste — see "Next" at the bottom and `docs/DEPLOY.md`.

Nothing has been committed since the Phase 0 commit; ask before committing.

## Final run (2026-09-08, from `supabase db reset`)

```
db:      supabase db reset          -> 8 migrations + 13 seeds, ~25 s
         supabase db lint           -> 0 errors
web:     pnpm typecheck             -> clean
         pnpm lint                  -> clean
         pnpm test  (vitest)        -> 7 files, 34 tests passed
         pnpm build                 -> clean production build (55 routes)
         pnpm test:e2e (prod build) -> 9 passed (51.3s) (9 demo-path tests incl. axe)
         lighthouse (desktop)       -> /login 95 / 100 / 100 / 100, / 100 / 96 / 100 / 100
                                        (perf / a11y / best-practices / seo; LCP 0.9 s, CLS 0)
worker:  pytest -m "not requires_ollama" -> 34 passed
         pytest -m requires_ollama        -> 7 passed, 1 failed in the full 8-test run (5:15, run under load);
                                             the failing items test then passed in isolation (1 passed, 6:34) after the
                                             gateway/Ollama fixes below; the Hindi lesson-plan test passed in the same pass
```

## Demo tenant (Section 9) — as seeded

62 sections · 180 teaching staff with logins (+3 named coordinators) · 130 students
(two full Class 6 sections + transition/portal cohorts) · 400 outcomes per tenant across
CBSE / IB / Cambridge / AP · 620 items (200 human-written, 400 AI, 20 planted miscalibrated)
· 180 SAARTHI artifacts (140 approved with edit distances, 3 in Hindi) · one complete
DARPAN term for 6A + 6B (392 observations, 356 360° inputs, 266 approved descriptors,
4 unapproved, released reports) · CPD for 40 teachers · timetable for the demo teacher
· Class 10 two-exam calendar · 637 gateway records (hash only) · 828 approvals.
54 RLS-enabled tables, 216 indexes. Snapshot in schema `demo_snapshot`; `reset_demo()`
restores it in well under 45 s (measured in `web/tests/hardening.test.ts`).

## Acceptance tests by phase

### Phase 0 — Foundation & gateway (all green, unchanged)
1. Cross-tenant isolation — `web/tests/rls.test.ts`
2. No student PII in any constructed prompt (50-student cohort) — `worker/tests/test_redact.py`
3. Gateway schema-valid from Ollama + fallback when primary unreachable — `test_gateway.py` (live)
4. Artifact cannot enter `approved` without an `approvals` row — `web/tests/approval.test.ts`
5. `verify_chain()` OK on 30 events, detects tampering — `web/tests/audit.test.ts`

### Phase 1 — SETU (`worker/tests/test_setu.py`)
400 outcomes ingested across 4 frameworks with embeddings; alignment engine proposes,
60 human-confirmed equivalents; LLM relation labelling (live); transition report for a
CBSE→Cambridge student lists 7 gaps as PDF in < 5 s; coverage suppresses cells < 5.

### Phase 2 — PRASHNA (`worker/tests/test_prashna.py`)
20 case-based items generated from CBSE.SCI.10.4.2, every one outcome-linked (live);
paper assembled to blueprint at exactly 50.0 % competency share; improvement paper is
disjoint with the same competency share; marks import + calibration flags the 20 planted
items and no others; zero-link item save rejected by the DB.

### Phase 3 — SAARTHI (`worker/tests/test_saarthi.py`)
Worksheet without an outcome link cannot be saved; approval gate on artifacts; parent
message redaction round-trip (live); comparative/diagnostic language rejected (live);
lesson plan + Hindi worksheet with Devanagari PDF (live); remediation set is bank-first.

### Phase 4 — DARPAN (`worker/tests/test_darpan.py`, `web/tests`)
Descriptor prompt carries no PII (live); `super_admin` gets zero DARPAN content rows; peer
input anonymised to the receiving student; descriptor guardrail; HPC report PDF; release
to parent; token link submits without login.

### Phase 5 — UDAY (`worker/tests/test_uday.py`)
Unit must keep ≥ 1 unplugged activity; hours ledger and Monday projections; evidence pack
PDF for a grade; no AI scoring path for projects.

### Phase 6 — Hardening & demo (`worker/tests/test_phase6.py`, `web/tests/hardening.test.ts`, `web/e2e`)
- Every FK column indexed; every table with `school_id`/`student_id` has RLS + ≥ 1 policy.
- `reset_demo()` restores the snapshot (measured < 45 s; audit rows preserved).
- MFA helper: privileged roles gated only once a verified factor exists.
- Digests enqueue (pg_cron functions) and deliver via SMTP to Mailpit with no student names.
- DPDP export contains only that student; erasure anonymises the row and deletes personal records.
- Substitute pack contains approved material only; leadership PDF renders.
- Playwright demo path (teacher, principal, parent, student, cross-tenant) with axe WCAG 2.1 AA
  on dashboard / My Day / approvals / leadership / parent portal; security headers asserted.
- Lighthouse ≥ 90 on public pages (table above).
- Screenshot pack: `docs/screenshots/` — 12 desktop 1440×900 + 6 mobile 390×844.

## Phase 6 deliverables

- Migration `0008_hardening.sql`: indexes, `timetable_periods`, `exam_events`,
  `notification_queue` + pg_cron (08:00 HOD digest, Mon 09:00 descriptor reminders,
  03:00 coverage refresh), `erasure_requests` + `execute_erasure()`, MFA restrictive
  policies (`privileged_aal_ok()`), `my_sessions` + `revoke_my_session()`,
  `snapshot_demo()` / `reset_demo()`.
- Seed `0013_demo.sql` (generated by `worker/scripts/gen_demo_seed.py`).
- Worker: `/notify/flush`, `/notify/enqueue-now` (Resend or SMTP), `/dpdp/export`,
  `/dpdp/erase`, `/saarthi/substitute-pack`, `/leadership/report`; Dockerfile.
- Web: security headers (CSP/HSTS/COOP…), `/my-day` (period-aware, substitute pack),
  `/approvals` (one keyboard queue across items/artifacts/descriptors), `/exams`
  (calendar + Class 10 two-exam planner), `/leadership` (AI usage, edit-distance,
  time-saved with stated assumptions, PDF), `/audit` (chain badge, filters),
  `/security` (TOTP enrolment, MFA challenge at login, device sessions), `/consent`
  (DPDP ledger, export, erasure workflow; parent portal export/erasure), `/admin`
  (reset demo, digests, tour), guided tour, ⌘K global actions, Hindi/English on all
  new screens, PWA manifest + service worker.
- Deploy: `web/vercel.json`, `render.yaml`, `worker/Dockerfile`; CI unchanged.
- Docs: README, `docs/DEMO-SCRIPT.md`, `FRAMEWORK-MAP.md`, `DATA-MODEL.md`,
  `SECURITY.md`, `DEPLOY.md`, updated `SAFETY.md`, `ARCHITECTURE.md`, `AI-GATEWAY.md`.

## Fixes made this session to earlier phases

- `test_redact.py` cohort filter (the SETU seed moves KAL-2026-0007 to 9A; the Phase-6
  erasure test adds an `ERASED-` row) — now selects admission numbers 0001–0050 explicitly.
- ⌘K palette never mounted its `Command` root (base-nova `CommandDialog` does not supply
  one) — a latent Phase 0 bug found by the new e2e suite; fixed in
  `components/shell/command-palette.tsx`.
- Vitest integration files now run serially (`fileParallelism: false`): the approval-gate
  test raced `reset_demo()`.
- `Counter` (`components/motion/primitives.tsx`) looped ("Maximum update depth exceeded")
  under reduced motion because its effect depended on an inline `format` function — now
  read through a ref.
- Hydration mismatch (shifted Base UI `useId`s) whenever the browser has
  `prefers-reduced-motion`: `template.tsx`, `Reveal`, `Stagger`, `SplitWords` and
  `Magnetic` returned a different element tree in reduced mode. They now render the same
  tree and only drop the animation.
- Gateway retry (rule 15) now feeds the validator's field errors back to the model, and a
  Devanagari script check joins schema validation for Hindi templates — both found by the
  live-model run, where llama3.1:8b drifted on `parts[].text` and answered a Hindi
  worksheet in English.

## Known limits / honest notes

- MFA is enforced by RLS only for principal / academic_head / super_admin once they enrol;
  demo accounts are unenrolled so the demo flows without an authenticator.
- Time-saved figures are stated assumptions (`web/lib/leadership.ts`), not measurements.
- `generation_log` rows in the seed are synthetic (hash only) so the leadership view reads
  like a real term; live generations append real rows.
- Hindi coverage: shell, portals, all Phase-6 screens and generated artifacts; module
  screens from Phases 1–5 remain English-first.
- Ollama-dependent tests are run locally (CI runs the fast suite). Ollama calls now set
  `num_ctx 8192 / num_predict 4096` and a 300 s timeout (`OLLAMA_TIMEOUT_S`): the 2048-token
  default context truncated long outputs and timed out under load.
- `reset_demo()` must not run while generations are in flight for the same tenant (the
  hardening test fails only when the live-model suite is writing concurrently).

## Next

1. Deploy: needs Vercel token/project, Render API key (or Blueprint connect), Supabase
   project ref + service key (ap-south-1), Gemini + Groq keys, Resend key. Then
   `supabase db push` + seed, Render blueprint, Vercel import, smoke per `docs/DEPLOY.md`.
2. Commit + remote — on request only.
