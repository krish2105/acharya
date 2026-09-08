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
