# PROGRESS

## Phase 0 -- Foundation and AI gateway: COMPLETE

All Phase 0 tasks (Section 8) are built and verified against a real, running
local stack (Supabase Postgres via `supabase start`, Ollama `llama3.1:8b`
locally). Nothing from Phases 1-6 was built.

### Acceptance tests (Section 8) -- all passing, with real evidence

1. **Two seeded tenants; a user in tenant A gets zero rows from tenant B.**
   `web/tests/rls.test.ts` -- logs in as the real seeded `teacher@kalanjali.demo`
   user via the Auth API, confirms 50 visible students (all tenant A), and
   confirms an explicit filter for tenant B's `school_id` returns `[]`.
2. **Redaction: no PII from the 50 seeded students in any constructed
   prompt.** `worker/tests/test_redact.py` -- for every one of the 50 seeded
   students (+ their guardian), builds a realistic prompt and asserts none of
   name/admission_no/dob/phone/email survive redaction, then confirms
   re-substitution restores the name for the final output.
3. **Gateway returns schema-valid output from local Ollama, and falls back
   correctly when the primary is unreachable.** `worker/tests/test_gateway.py`
   -- one test calls the real local Ollama server and gets schema-valid JSON
   back plus a `generation_log` row; a second test configures Gemini as
   primary with a *reachable-but-wrong* endpoint (an actual attempted-and-failed
   call, not just "no key set"), and confirms the gateway falls through Groq
   (unconfigured, skipped) to Ollama and still succeeds.
4. **An artifact cannot enter `approved` without an `approvals` row.**
   `web/tests/approval.test.ts` -- a direct `UPDATE ... SET status = 'approved'`
   with no approval on file is rejected by Postgres; `approveArtifact()` then
   writes the ledger row and the same transition succeeds.
5. **`verify_chain()` returns `OK` on 30 events and detects a tampered
   fixture.** `web/tests/audit.test.ts` -- 30 real events via `logEvent()`
   verify `OK`; a simulated lower-level compromise (superuser connection
   disabling the insert-only guard for one corrupting `UPDATE`, since no
   normal grant or permanent DB function can tamper with the table at all)
   is then detected and reported with the offending row id.

### Full test run (this session, from a clean `supabase db reset`)

```
web:    pnpm typecheck   -> clean
        pnpm lint        -> clean
        pnpm test        -> 6 files, 30 tests passed
        pnpm build       -> clean production build
worker: pytest           -> 4 passed (2 requires_ollama, run locally;
                             CI runs the other 2 -- see below)
db:     supabase db lint -> No schema errors found
```

CI (`.github/workflows/ci.yml`) runs everything above except the two
`@pytest.mark.requires_ollama` gateway tests, which need a local Ollama
server with a multi-GB model pulled -- impractical on a hosted runner. Those
two were run and verified live in this session (output above); see
`docs/AI-GATEWAY.md`.

### Deliverables checklist (Section 8)

- [x] `web/` (Next.js 15, TS, Tailwind 4, shadcn/ui) + `worker/` (FastAPI,
      Python 3.12) scaffolded per Section 5's tree
- [x] Local Supabase (`pgvector` enabled, unused until Phase 1) + local
      Ollama, both running
- [x] Migration `0001_tenancy.sql` -- schools, frameworks (7 seeded rows
      across the 4 boards), profiles, subjects, sections, students,
      guardians, teaching_assignments, custom JWT claims hook, RLS
- [x] Migration `0002_audit_gateway_approval.sql` -- hash-chained
      `audit_events` + `verify_chain()`, `prompt_templates`,
      `generation_log`, `approvals`, `enforce_approval_gate()`,
      `demo_artifacts` (Phase 0's own throwaway proof table)
- [x] `web/lib/rbac` -- `can(user, action, module, resource)`, Section 3's
      matrix transcribed as data, 15 unit tests
- [x] `web/lib/audit` -- `logEvent()`, `verifyChain()`
- [x] **AI gateway** (`worker/app/gateway.py`) -- gemini → groq → ollama
      fallback, schema validation + 1 retry, `generation_log` writes
- [x] **Redaction layer** (`worker/app/redact.py`) -- context-aware known-value
      substitution + re-substitution
- [x] `web/lib/approval` -- `approveArtifact()` (with Levenshtein edit
      distance), `transitionArtifactStatus()`
- [x] Approval card + outcome chip components, wired to a seeded artifact,
      manually verified end to end in a real browser session (login →
      approve → reload → still approved → DB rows confirmed)
- [x] App shell -- sidebar (RBAC-gated), framework switcher, role badge,
      login/logout, auth guard
- [x] CI (`.github/workflows/ci.yml`)
- [x] `docs/ARCHITECTURE.md`, `docs/AI-GATEWAY.md`, `docs/SAFETY.md` v1
- [x] Green CI-equivalent run (see above; no GitHub remote exists yet to
      trigger real Actions -- ask before creating one)

### Two things that had to be airtight (kickoff instruction #5)

- **PII redaction**: DB-verified against all 50 seeded students, both
  directions (redact + re-substitute), via a real prompt-construction
  scenario, not a synthetic one-liner.
- **Approval gate**: enforced by a Postgres trigger
  (`enforce_approval_gate()`), not application code -- proven by directly
  attempting to bypass it in SQL, both in this session's manual verification
  and in the automated `approval.test.ts`.

### Assumptions and deviations from the master document (flagged as they arose)

1. **JWT claim renamed `role` → `user_role`.** PostgREST reserves the `role`
   claim to select the Postgres database role executing the request;
   overwriting it with an app-level value (`'teacher'`) broke PostgREST's own
   role switching. Section 6.8's illustrative RLS snippets use
   `auth.jwt() ->> 'role'` for the app role -- every future phase's RLS
   policy must use `user_role` instead. Documented in `docs/ARCHITECTURE.md`.
2. **`demo_artifacts` is a Phase-0-only table**, not Section 6.5's real
   `artifacts` table (that's Phase 3/SAARTHI). It exists only to prove the
   approval gate, the approval card and the outcome chip end to end before
   any real feature table exists, per the master doc's own phrase "wired to
   a seeded dummy artifact."
3. **AI provider fallback tested without real Gemini/Groq credentials** (per
   your answer to my first clarifying question) -- `.env.example` documents
   the keys; the fallback test proves the fallthrough logic with a
   configured-but-unreachable primary rather than a live cloud call. Add real
   keys later; no feature code changes required (rule 16).
4. **Local Supabase only**, ports shifted +20 in `supabase/config.toml`
   (54341/54342/54343/54344/54349) because this machine already runs another
   project's local Supabase stack on the CLI's default ports. `analytics`
   and `edge_runtime` are disabled -- unused in Phase 0, and disabling them
   meaningfully reduced load on the Colima VM.
5. **Worker Python is 3.12** via Homebrew (`python@3.12`), matching the
   pinned stack -- the system's default `python3` was 3.14.
6. **Two seeded tenants**: "Kalanjali International School, Jaipur" (the
   fixed fictional demo tenant, minimally seeded -- full demo data per
   Section 9 is a Phase 6 task) + a throwaway fictional "Rivermist Public
   School" that exists only to prove cross-tenant isolation, never a demo
   asset.
7. **No git commits or GitHub remote were created.** Ask before either.

## Next session

Phase 1 -- SETU. Read `CLAUDE.md`, this file, and re-read Section 2
(non-negotiable rules) and Section 8's Phase 1 tasks in the master document
before starting.

## Local dev quick start

```bash
colima start                    # Docker runtime (if not already running)
supabase start                  # local Postgres/Auth/Storage/REST
supabase db reset               # apply migrations + seed data
ollama serve                    # if not already running
cd web && pnpm install && pnpm dev
cd worker && source .venv/bin/activate && uvicorn app.main:app --reload
```

Test credentials (local only): `teacher@kalanjali.demo` / `Demo@2026`
(also `academic@kalanjali.demo`, `hod@kalanjali.demo`,
`teacher@rivermist-test.demo`).
