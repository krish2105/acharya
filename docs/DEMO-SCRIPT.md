# ACHARYA — 20-minute demo script

Demo tenant: **Kalanjali International School, Jaipur** (fictional; 5,400 students,
62 sections, CBSE + IB DP + Cambridge + AP). Every name is synthetic. Password for
every demo login is `Demo@2026`.

| Minute | Screen | Say | Show |
|---|---|---|---|
| 0–1 | `/login` → chip **Teacher** | "One login, one spine, four boards." | Kinetic headline; marquee of outcome codes from all four boards. |
| 1–3 | `/dashboard` | "This tile is the whole product: *N PII spans redacted, 0 reached a model.* Everything else is a draft waiting for a teacher." | Counters animate; approval card with generated vs edited diff; **Approve** writes a ledger row. |
| 3–5 | `/my-day` | "Period-aware. The unit each class is in, what's waiting, one click to a worksheet." | Current period ring; **Substitute pack (PDF)** — only approved material leaves the building. |
| 5–8 | `/setu/coverage` → `/setu/transitions` | "Curriculum spine across boards. Taught vs assessed per outcome; cells under 5 are suppressed." | Coverage heatmap; transition report for KAL-2026-0007 (CBSE → Cambridge): 7 gaps, PDF in 3 s. |
| 8–11 | `/prashna/generate` → `/prashna/review` | "20 case-based items, every one pinned to a competency. HOD approves with **A**." | Generate from CBSE.SCI.10.4.2; HOD review queue keyboard; then `/exams` — Class 10 two-exam planner pairs a main paper with a matched improvement paper. |
| 11–14 | `/saarthi/generate` | "Lesson plan in Hindi. Streamed, schema-checked, and it *cannot* be shared until approved — the database refuses." | Generate → edit in TipTap → **Approve** → share to Science teachers. `/saarthi/remediation`: bank-first, 60% from existing items. |
| 14–17 | `/darpan/descriptors` | "Progress card descriptors from what teachers wrote and 360° inputs. Comparative or diagnostic language is rejected before you see it." | Draft → edit → approve; `/darpan/reports` → release to parent. Switch to chip **Parent**: released card, DPDP **Download all data held**. |
| 17–18 | `/uday` | "The AI & CT programme's evidence pack — hours ledger, projects, CPD — one PDF." | Evidence pack for Grade 6. |
| 18–19 | chip **Principal** → `/leadership` | "What was generated, what teachers changed, and what it saved — assumptions shown, not hidden." | Edit-distance chart; **Export PDF**. `/audit` → *Chain verified*. `/security` → MFA. |
| 19–20 | chip **Super admin** → `/admin` | "Reset the demo in under 45 seconds. Audit rows stay — they're append-only." | **Reset now** shows elapsed time. `⌘K` → *Start the guided tour*. |

## Logins

| Role | Email | Lands on |
|---|---|---|
| Teacher (Science, 6A/6B/9A/9B/10A) | teacher@kalanjali.demo | `/dashboard` |
| HOD Science | hod@kalanjali.demo | `/dashboard` → `/prashna/review` |
| Academic head | academic@kalanjali.demo | full modules |
| Principal | principal@kalanjali.demo | `/leadership`, `/consent`, `/audit` |
| IB coordinator | ibcoord@kalanjali.demo | IB DP scope only |
| Exam officer | exam@kalanjali.demo | `/exams`, PRASHNA papers |
| CT/AI lead | ctlead@kalanjali.demo | UDAY full |
| Parent | parent@kalanjali.demo | `/parent` |
| Student | student@kalanjali.demo | `/student` |
| Super admin | super@acharya.demo | `/admin` (never sees DARPAN content) |

Any of the 177 generated teachers: `teacher004@kalanjali.demo` … `teacher180@kalanjali.demo`.

## Things that go wrong, and what to say

- **Ollama is slow on first call** (model load): "Local model, no data leaves the room; production uses Gemini Flash with Groq and Ollama as fallbacks." Use `/saarthi/history` (180 pre-approved artifacts) while it warms.
- **Someone asks for AI-detection / "which students are weak":** point at `docs/SAFETY.md`. The answer is no; the aligned alternative is on the same page.
- **Demo data got messy:** `/admin` → Reset now (super admin), or `supabase db reset` locally.
