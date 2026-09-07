# ACHARYA

Multi-tenant AI teaching platform for multi-board Indian schools (CBSE, IB,
Cambridge, AP). ACHARYA generates **aligned drafts, never decisions** -- see
`CLAUDE.md` for the build rules and `docs/SAFETY.md` for what it refuses to
do.

**Status:** Phase 0 (foundation + AI gateway) complete. See `PROGRESS.md`.

## Local development

```bash
colima start                    # Docker runtime
supabase start                  # local Postgres/Auth/Storage/REST
supabase db reset               # apply migrations + seed data
ollama serve                    # local model runtime (llama3.1:8b)

cd web && pnpm install && pnpm dev        # http://localhost:3000
cd worker && source .venv/bin/activate && uvicorn app.main:app --reload
```

Test login (local only): `teacher@kalanjali.demo` / `Demo@2026`.

## Tests

```bash
cd web && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd worker && source .venv/bin/activate && pytest   # requires Ollama for 2 tests
supabase db lint
```

## Docs

- `docs/ARCHITECTURE.md` -- system layout, tenancy, RLS, RBAC, audit chain, approval gate
- `docs/AI-GATEWAY.md` -- provider fallback, redaction, schema validation
- `docs/SAFETY.md` -- refusals and what's DB-enforced today
- `ACHARYA-Claude-Code-Master-Prompt.md` -- the full product/build spec
