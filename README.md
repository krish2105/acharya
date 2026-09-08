# ACHARYA

Multi-tenant AI teaching platform for multi-board Indian schools (CBSE, IB,
Cambridge, AP). ACHARYA generates **aligned drafts, never decisions** -- see
`CLAUDE.md` for the build rules and `docs/SAFETY.md` for what it refuses to
do.

**Status:** Phases 0–6 built and verified locally (SETU · PRASHNA · SAARTHI · DARPAN · UDAY, hardening, demo seed). See `PROGRESS.md`. Deployment: `docs/DEPLOY.md`.

## Local development

```bash
colima start                    # Docker runtime
supabase start                  # local Postgres/Auth/Storage/REST
supabase db reset               # apply migrations + seed data
ollama serve                    # local model runtime (llama3.1:8b)

cd web && pnpm install && pnpm dev        # http://localhost:3000
cd worker && source .venv/bin/activate && uvicorn app.main:app --reload
```

Demo logins (local only, password `Demo@2026`): `teacher@`, `hod@`, `academic@`, `principal@`, `ibcoord@`, `exam@`, `ctlead@`, `parent@`, `student@` — all `@kalanjali.demo`; `super@acharya.demo`. Full walkthrough: `docs/DEMO-SCRIPT.md`.

Mail lands in Mailpit at http://127.0.0.1:54344 locally.

## Tests

```bash
cd web && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd web && pnpm exec playwright install chromium && pnpm test:e2e   # demo path + axe, needs web/worker/supabase up
cd worker && source .venv/bin/activate && pytest -m "not requires_ollama"   # fast suite
cd worker && pytest                                                          # + live Ollama tests
supabase db lint
```

## Docs

- `docs/ARCHITECTURE.md` -- system layout, tenancy, RLS, RBAC, audit chain, approval gate
- `docs/AI-GATEWAY.md` -- provider fallback, redaction, schema validation
- `docs/SAFETY.md` -- refusals and what's DB-enforced
- `docs/SECURITY.md` -- RLS, headers, MFA, sessions, DPDP
- `docs/DATA-MODEL.md` -- every table by migration
- `docs/FRAMEWORK-MAP.md` -- four boards, one spine
- `docs/DEMO-SCRIPT.md` -- the 20-minute demo
- `docs/DEPLOY.md` -- Vercel + Render + Supabase
- `ACHARYA-Claude-Code-Master-Prompt.md` -- the full product/build spec
