# ACHARYA — Build Rules

## What this is
Multi-tenant AI teaching platform for multi-board Indian schools (CBSE, IB, Cambridge, AP).
Modules: SETU (curriculum spine), PRASHNA (competency items + papers), SAARTHI (teacher
copilot), DARPAN (holistic progress card), UDAY (AI & Computational Thinking programme).

## Thesis
ACHARYA generates ALIGNED DRAFTS, NEVER DECISIONS.
Every AI output ties to a named learning outcome in a named framework, is schema-validated
before a human sees it, and requires explicit teacher approval before reaching a student.
The value is alignment and approval. Anyone can generate.

## Absolute prohibitions
- AI never sets a final grade. No auto-submit path exists.
- No AI-detection score on student work: not in schema, API, import or UI
- No student profiling, risk scoring, learner-type labels or prediction
- No behaviour or engagement surveillance. Observations are teacher-written only.
- No student PII in any prompt. Redaction happens before prompt construction.
- Nothing AI-generated reaches a student without an approvals row (DB-enforced)
- No real student, teacher or school data. Synthetic seeds only.
- Never name a real school. Demo tenant = "Kalanjali International School, Jaipur" (fictional).

## Alignment rules
- Every item and artifact must link to >= 1 learning outcome (DB trigger)
- Only human_confirmed alignments count for coverage and generation
- All model output is validated against the template's JSON schema; one retry, then fail loudly
- Store both the generated version and the human-edited version, with edit distance

## Engineering rules
- State assumptions before coding. If two readings exist, ask; do not choose silently.
- Minimum code that solves the problem. No speculative abstraction.
- Surgical edits only. Do not refactor adjacent code. Remove only orphans you created.
- Every task stated as: `1. [step] -> verify: [check]`. Loop until verify passes.
- RLS on every table with personal data. A table without a policy is a build failure.
- One phase per session. Update PROGRESS.md before ending any session.

## Stack
Next.js 15 App Router · TS · Tailwind 4 · shadcn/ui · motion (from "motion/react") · TipTap ·
Supabase (ap-south-1, pgvector) · FastAPI on Render · sentence-transformers (local embeddings) ·
WeasyPrint · Vitest · Playwright · pytest.
AI: provider-agnostic gateway. Gemini Flash free tier -> Groq -> local Ollama.
Never hardcode a provider in feature code. Local dev must run fully offline on Ollama.

## Commands
pnpm dev · pnpm test · pnpm test:e2e · pnpm build · supabase start · supabase db reset ·
uvicorn app.main:app --reload · pytest · ollama serve

## Definition of done for a phase
All acceptance tests in the master prompt pass, CI green, PROGRESS.md updated.
