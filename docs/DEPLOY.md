# Deploy

Three managed services; nothing else to run.

| Piece | Where | Config |
|---|---|---|
| Web (Next.js 15) | Vercel, region `bom1` (Mumbai) | `web/vercel.json`, root directory `web` |
| Worker (FastAPI) | Render, region Singapore, Docker | `render.yaml`, `worker/Dockerfile` |
| Postgres / Auth / Storage | Supabase, region `ap-south-1` | `supabase/config.toml` (local), migrations + seed |

## 1. Supabase
```bash
supabase link --project-ref <ref>
supabase db push                      # migrations 0001–0008
supabase db seed                      # or: psql "$DATABASE_URL" -f supabase/seed/00XX.sql in order
```
Then in the dashboard: Auth → Hooks → *Customize Access Token* → `public.custom_access_token_hook`;
Auth → MFA → enable TOTP; Database → Extensions → `pg_cron`, `vector` (enabled by migrations where allowed).
Buckets `artifacts`, `papers`, `evidence`, `projects`, `cpd` are created by the seed as private.

## 2. Worker (Render)
`render.yaml` is a Blueprint: New → Blueprint → this repo. Set the `sync: false`
env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`,
`GROQ_API_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `WEB_URL`. `WORKER_TOKEN` is
generated. The cron service posts to `/notify/flush` every 15 minutes.

## 3. Web (Vercel)
Import the repo, root directory `web`. Environment:
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
NEXT_PUBLIC_WORKER_URL=https://acharya-worker.onrender.com, WORKER_TOKEN=<from Render>
```
Production headers (HSTS, CSP with `upgrade-insecure-requests`) switch on automatically when `NODE_ENV=production`.

## 4. Smoke
- `/login` → Teacher chip → dashboard tile shows *0 reached a model*.
- `/admin` as super admin → Worker tile *up*; **Enqueue & send** delivers via Resend.
- `/audit` → *Chain verified*.

## Local
`README.md`. Ollama is the local provider; the same code paths run with `AI_PROVIDER=gemini` in production, falling back gemini → groq → ollama.


## Live deployment (2026-09-08)

| Piece | URL / id |
|---|---|
| Web (Vercel, bom1) | https://acharya-vert.vercel.app — project `prj_FzgVAVnpg6QQiby7nsdNUnJMqnKU`, repo `krish2105/acharya`, root `web` |
| Worker (Render, Singapore, free) | https://acharya-worker.onrender.com — service `srv-dafrvpv40ujc73cmt3pg`, Docker from repo root |
| Database (Supabase, ap-south-1) | https://jhxovzrawwdeqjpjqjfn.supabase.co — project `raqib` reused (its own tables are empty and do not clash); migrations 0001–0008 + buckets applied as one migration `acharya_0001_tenancy_to_0008_hardening` |

### Environment variables to set (secrets are never in the repo)

**Vercel → acharya → Settings → Environment Variables** (then redeploy):
```
NEXT_PUBLIC_SUPABASE_URL=https://jhxovzrawwdeqjpjqjfn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoeG92enJhd3dkZXFqcGpxamZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2Mzc2MDgsImV4cCI6MjEwNDIxMzYwOH0.0MNpK_UQQcDVC8mFkbOt6G5FfCZjZ922AXQG1wbaAAs
SUPABASE_SERVICE_ROLE_KEY=<Supabase → Settings → API → service_role>
NEXT_PUBLIC_WORKER_URL=https://acharya-worker.onrender.com
WORKER_TOKEN=<same value as the Render service's WORKER_TOKEN>
```

**Render → acharya-worker → Environment** (already set: AI_PROVIDER, GEMINI_MODEL, GROQ_MODEL, WORKER_TOKEN, MAIL_FROM, WEB_URL, SUPABASE_URL):
```
SUPABASE_SERVICE_ROLE_KEY=<service_role>
GEMINI_API_KEY=<...>
GROQ_API_KEY=<...>
RESEND_API_KEY=<...>            # optional; without it digests are logged as failed
```

### Seed the cloud database (once)
1. Supabase → Settings → Database → Connection string (Session pooler) → put it in `supabase/.cloud.env` as `SUPABASE_DB_URL=...` (git-ignored).
2. `./scripts/seed-cloud.sh` — applies the 13 seed files in order and prints the counts.

### Dashboard toggles (no API for these)
- Auth → Hooks → **Customize Access Token (JWT) Claims** → enable → Postgres function `public.custom_access_token_hook`.
- Auth → Multi-Factor → enable **TOTP**.
- Auth → URL configuration → Site URL `https://acharya-vert.vercel.app`.
