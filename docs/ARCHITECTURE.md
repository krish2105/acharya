# Architecture (Phase 0)

This describes what Phase 0 actually built: a multi-tenant, multi-board shell
where no model call can leak student data and no generated artifact can reach
a child unapproved. It does not describe SETU/PRASHNA/SAARTHI/DARPAN/UDAY's
feature content -- those are Phases 1-5.

## Components

```
web/     Next.js 15 App Router, TypeScript, Tailwind 4, shadcn/ui
worker/  FastAPI (Python 3.12): the AI gateway, redaction, provider abstraction
supabase/ Postgres 17 (local, via `supabase start`): schema, RLS, seed data
```

`web/` talks to Postgres directly via Supabase's client libraries (RLS-scoped
for user-facing reads/writes, service-role for trusted server-only writes
like the audit log). `worker/` is the only thing that calls a model provider;
feature code never calls Gemini/Groq/Ollama directly.

## Tenancy and RLS

Every table holding tenant or personal data has `school_id` and an RLS policy
scoping it to `(auth.jwt() ->> 'school_id')::uuid` (migration `0001_tenancy.sql`,
`0002_audit_gateway_approval.sql`). A table without a policy is a build
failure (rule 11). Phase 0's negative test: a user in one tenant gets zero
rows querying another tenant's `students`, whether or not they explicitly
filter for it -- see `worker`/`web` test suites.

## Custom JWT claims: `user_role`, not `role`

A Postgres Auth Hook (`custom_access_token_hook`, in `0001_tenancy.sql`)
injects `school_id`, `user_role`, `framework_id` and `subject_id` into every
access token, read from `profiles`.

**Deviation from the master document:** the app-level role claim is named
`user_role`, not `role`. Section 6.8's illustrative RLS snippets read
`auth.jwt() ->> 'role'` for the app role (`'teacher'`, `'hod'`, ...) -- but
PostgREST reserves the JWT claim key `role` to select which *Postgres*
database role executes the request (normally `authenticated`). Overwriting
it with an app-level value breaks PostgREST's own role switching
(`role "teacher" does not exist`). Every RLS policy that needs the app role
in a later phase must read `auth.jwt() ->> 'user_role'`.

## RBAC (`web/lib/rbac`)

`can(user, action, module, resource?)` is the single function all UI gating
routes through (task 4). It's driven by a data table (`matrix.ts`) transcribed
from Section 3's permission matrix. `can()` is a UX-gating convenience, not
the security boundary -- RLS is. A future phase's RLS policy and `can()` cell
for the same role/module should agree, but if they ever drift, RLS wins.

## Audit chain (`web/lib/audit`, `audit_events` table)

`audit_events` is insert-only (`0002_audit_gateway_approval.sql`): a
`BEFORE INSERT` trigger computes `hash`/`prev_hash` server-side (chained per
`school_id`), and `BEFORE UPDATE OR DELETE` triggers reject every mutation
unconditionally -- there is no way to tamper with a row through any grant a
normal client role could hold. `verify_chain(school_id)` recomputes the chain
and returns `'OK'` or a `'TAMPERED at id=...'` description of the first break.
Because normal tampering is impossible by construction, the regression test
proves detection by simulating a lower-level compromise (a superuser
connection disabling the guard trigger for one corrupting UPDATE) rather than
by calling any permanent "disable the audit guard" function -- no such
function exists in the schema.

## Approval gate (`web/lib/approval`, `enforce_approval_gate()`)

`enforce_approval_gate()` is a generic, reusable trigger function (no
hardcoded table knowledge): given an artifact_type and a comma-separated list
of gated status values, it blocks a row from entering any of those statuses
unless a matching `approvals` row (with `approved_at is not null`) already
exists. Every future phase's artifact table (`items`, `papers`, `artifacts`,
`hpc_descriptors`, ...) attaches this same function -- see `demo_artifacts`
in migration `0002` for the reference wiring, built only to prove the gate
and the approval card end to end before any real feature table exists.

`approveArtifact()` writes the `approvals` ledger row (with a Levenshtein
edit distance between the generated and final JSON) and must be called
*before* `transitionArtifactStatus()` -- the database rejects the reverse
order.

## Local development

- `supabase start` runs on Docker via Colima. This machine also runs another
  project's local Supabase stack, so `supabase/config.toml` shifts every
  port by +20 (API 54341, DB 54342, Studio 54343, Inbucket 54344, Pooler
  54349) to avoid colliding with it. A machine running only this project
  could use the CLI's defaults instead.
- `analytics` (Vector + Logflare) and `edge_runtime` are disabled in
  `config.toml` -- Phase 0 doesn't use Supabase Edge Functions or local log
  aggregation, and disabling them meaningfully cuts load on a
  resource-constrained dev VM.
- `AI_PROVIDER=ollama` locally; `worker/.venv` is Python 3.12 (the pinned
  stack version -- this machine's system Python was 3.14, installed via
  Homebrew's `python@3.12` instead).

## Deliberately out of scope for Phase 0

SETU/PRASHNA/SAARTHI/DARPAN/UDAY feature tables, the framework ingestion
pipeline, embeddings, and Playwright E2E coverage. See the master document,
Section 8, Phases 1-6.
