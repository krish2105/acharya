# ACHARYA — Claude Code Master Build Prompt

**The AI teaching layer for multi-board schools (CBSE · IB · Cambridge · AP)**
Version 1.0 · Author: Krishna Mathur · Build agent: Claude Code

---

## 0. How to use this document

1. Create an empty folder `acharya/`, `cd` into it, run `claude`.
2. Paste **Section 14 (Session 1 Kickoff Prompt)** as your first message, with this whole document pasted where indicated.
3. Claude Code creates `CLAUDE.md` from **Section 13**, then executes **Phase 0**.
4. For each later session, paste the **Resume Prompt (Section 15)** with the phase number.
5. Never start a phase until the previous phase's **Acceptance Tests** pass.

One phase per session. If a session runs long, stop at the last passing checkpoint and update `PROGRESS.md`.

---

## 1. Product brief

**ACHARYA** (आचार्य, "teacher") is a multi-tenant platform that gives a school's teachers AI that is aligned to their actual syllabus, safe with children's data, and always under human approval.

**Positioning line:** *Your teachers are already using AI. ACHARYA makes it aligned to your syllabus, safe with your students' data, and always approved by a human before it reaches a child.*

**The problem it solves.** Over 70% of Indian teachers already use AI for lesson planning and question setting. They do it in free consumer tools, individually, with student names in the prompt, producing content that is plausible but not aligned to any board's learning outcomes. Meanwhile the 2026-27 CBSE overhaul has doubled their workload: 50% competency-based questions, two board exams for Class 10, a new compulsory AI & Computational Thinking subject for Classes 3–8, and Holistic Progress Cards requiring narrative descriptors for every child. A school running four curricula at once carries all of that four times over.

**The design thesis, which governs every decision in this build:**
> ACHARYA generates **aligned drafts, never decisions.** Every AI output is tied to a specific learning outcome in a specific framework, is validated against a schema before a human sees it, and requires explicit teacher approval before it reaches a student. The product's value is alignment and approval, not generation. Anyone can generate.

### Modules

| Code name | Meaning | Scope |
|---|---|---|
| **SETU** | bridge | Multi-board curriculum spine: concept graph with CBSE, IB, Cambridge and AP outcomes mapped onto it; pacing, coverage, board-transition gap reports |
| **PRASHNA** | question | Competency item bank, blueprint-compliant paper generator, difficulty calibration from real response data |
| **SAARTHI** | charioteer | Sanctioned teacher copilot: lesson plans, differentiated worksheets, rubrics, parent messages, with PII redaction and audit trail |
| **DARPAN** | mirror | Holistic Progress Card engine: evidence capture, 360-degree inputs, narrative descriptor drafting, stage-specific report generation |
| **UDAY** | dawn | AI & Computational Thinking programme for Classes 3–8: scheme of work, plugged and unplugged activities, hours ledger, project rubrics, teacher CPD tracking |

**Scope decision for v1: all four boards from day one.** SETU is therefore built before everything else, because every other module resolves against it.

### Regulatory and curricular anchors

- **CBSE board paper design** — approximately 50% competency-based questions (case studies, source-based, application MCQs), 20% objective, long-answer weightage reduced to about 30%; internal assessment 20–30%; 9-point grading.
- **CBSE two-exam system for Class 10** — main examination in February plus an optional improvement examination in May, best score counts. Doubles paper setting, correction and re-teaching load.
- **CBSE Circular Acad-15/2026** — Computational Thinking and AI compulsory for Classes 3–8 from the 2026-27 session. **50 hours per year for Classes 3–5, 100 hours per year for Classes 6–8.** Student and Teacher Resource Books published on cbseacademic.nic.in (Circular Acad-18/2026). "Computational Thinking and Understanding Artificial Intelligence" is CBSE's official teacher-training theme for 2026-27, with District Level Deliberations carrying 3–6 CPD hours each.
- **PARAKH / NCERT Holistic Progress Card** — 360-degree, multidimensional report across cognitive, affective, socio-emotional and psychomotor domains, with self-assessment, peer assessment, parent input and teacher observation; narrative and qualitative descriptions rather than only grades. Stage-specific templates for Foundational, Preparatory, Middle and Secondary. Extended to Middle Stage (Classes 6–8).
- **NCF-SE 2023 / NEP 2020** — competency-based education, three-language formula from Class 6, two-level mathematics and science at Class 9, vocational, art and physical education brought into core.
- **IB** — MYP objectives and criteria A–D, DP subject assessment objectives, ATL skills, internal assessment.
- **Cambridge** — Primary and Lower Secondary curriculum frameworks with numbered learning objectives; IGCSE assessment objectives.
- **Advanced Placement** — course and exam description units, topics, learning objectives, essential knowledge statements.
- **DPDP Act 2023 + DPDP Rules 2025** — every student under 18 is a child; verifiable parental consent; substantive compliance from 13 May 2027. This is why PII redaction is architectural, not optional.

---

## 2. NON-NEGOTIABLE RULES

These override every other instruction. If a task appears to require breaking one, **stop and ask the user.**

### 2.1 Product ethics

1. **AI never assigns a final grade.** It may draft feedback, suggest a band, or highlight rubric evidence. A teacher sets every mark. No auto-submit path exists in the codebase.
2. **No AI-detection score on student work.** Not in schema, API, import or UI. Detectors misfire on weaker and non-native writers, and an accusation against a child is disproportionate.
3. **No student profiling or prediction.** No risk scores, no learner-type labels, no dropout or performance prediction. Mastery is expressed **per learning outcome**, teacher-facing, and never as a label attached to a child.
4. **Nothing AI-generated reaches a student without explicit human approval.** Every generated artifact enters an approval queue. `approved_by` and `approved_at` are NOT NULL before an artifact can be published, printed or assigned. Enforce with a database trigger.
5. **No behaviour or engagement surveillance.** DARPAN observations are things a teacher deliberately wrote down, never system-inferred.
6. **Aggregate views suppress cells below 5.**

### 2.2 Data protection (architectural, not a checkbox)

7. **No student personal data leaves the system boundary into any model.** All inference calls pass through the AI gateway, which redacts names, admission numbers, phone numbers, email addresses and dates of birth **before** the request is built. Redaction is applied to the constructed prompt, not to the source record.
8. Every inference call writes a `generation_log` row: template, model, redacted prompt hash, token counts, latency, output, validation result, approver.
9. **Synthetic data only, always.** Never accept, request or store real student, teacher or school data during this build.
10. **Never name a real school** in code, comments, commits, seeds, screenshots or UI. The demo tenant is **"Kalanjali International School, Jaipur" (fictional, 5,400 students, running CBSE + IB DP + Cambridge + AP)**.
11. Row Level Security on every table containing personal data. A table without a policy is a build failure.
12. Data residency: Supabase region `ap-south-1` (Mumbai). Document it in the README.
13. Treat every student under 18 as a child under DPDP. Parent-facing consent records are captured for DARPAN parent inputs and any media use.

### 2.3 AI output discipline

14. **Every generated artifact is tied to at least one learning outcome** in a named framework. An artifact with no outcome linkage cannot be saved. This is what separates ACHARYA from a generic generator.
15. **All model output is schema-validated before it is shown.** Every prompt template declares a JSON schema; invalid output is retried once, then surfaced as a failure, never rendered raw.
16. **Provider-agnostic.** The gateway abstracts the model. Swapping providers must require changing one config value, not touching feature code.
17. **Show the teacher what changed.** When a teacher edits a generated draft, store both versions. The diff is used later to improve prompt templates and to demonstrate that humans are genuinely in the loop.

### 2.4 Engineering discipline (Karpathy guidelines)

18. **Think before coding.** State assumptions explicitly. If two interpretations exist, present both and ask. Do not choose silently.
19. **Simplicity first.** Minimum code that solves the problem. No speculative abstraction, no unrequested configurability, no error handling for impossible scenarios. If you wrote 200 lines and 50 would do, rewrite it.
20. **Surgical changes.** Touch only what the task requires. Do not refactor or reformat adjacent code. Remove only orphans your own change created.
21. **Goal-driven execution.** Before coding, state a plan as `1. [step] → verify: [check]`. Loop until verify passes.
22. Every phase ends with acceptance tests green. No "mostly working."

---

## 3. Roles and permission matrix

| Role | SETU | PRASHNA | SAARTHI | DARPAN | UDAY |
|---|---|---|---|---|---|
| `super_admin` (cross-tenant) | config | config | config | **no report content** | config |
| `principal` | full | full | full | full | full |
| `academic_head` | full | full | full | full | full |
| `board_coordinator` (IB DP / Cambridge / CBSE) | own framework | own framework | own framework | own framework | read |
| `hod` (subject) | own subject | own subject, approve items | own subject | read | read |
| `teacher` | read + propose alignment | own items, own papers | full for own classes | own students | own classes |
| `ct_ai_lead` | read | read | read | none | full |
| `exam_officer` | read | full papers + blueprints | none | none | none |
| `parent` (portal) | none | none | none | own child's report + parent input form | none |
| `student` (portal) | none | none | none | own self-assessment + peer input | own projects |

Rules:
- `hod` approval is required before an item enters the shared bank. A teacher's own unapproved items stay private to that teacher.
- `board_coordinator` sees only their framework's alignments, papers and reports.
- `super_admin` may never read DARPAN report content or teacher-student notes in any tenant. Enforce in RLS.
- Peer input in DARPAN is anonymised to the receiving student and visible in full only to the teacher.

---

## 4. Tech stack (pinned)

```
Frontend    Next.js 15 (App Router) + TypeScript 5.6 + Tailwind CSS 4 + shadcn/ui
Motion      motion (v12) — import from "motion/react", NOT framer-motion
Forms       react-hook-form + zod
Tables      @tanstack/react-table
Editor      TipTap (rich text for items, lesson plans, descriptors)
Charts      recharts
DB/Auth     Supabase (Postgres 16, Auth, Storage, RLS, pgvector) — region ap-south-1
Worker      FastAPI (Python 3.12) on Render free tier
AI gateway  Provider-agnostic. Default free tier: Google Gemini Flash.
            Fallbacks: Groq (Llama), local Ollama for offline dev.
            NEVER hardcode a provider in feature code.
Embeddings  sentence-transformers (local, free) → pgvector for outcome alignment
PDF         WeasyPrint (papers, HPC reports, schemes of work, CPD certificates)
Ingestion   pandas + openpyxl + pdfplumber (syllabus and framework documents)
Jobs        Supabase pg_cron
Email       Resend
Hosting     Vercel (web), Render (worker)
Tests       Vitest + Testing Library, Playwright (E2E), pytest (worker)
```

Hard constraints:
- **Free-tier inference only.** Gemini Flash free tier as default, Groq as fallback, Ollama for local development. The gateway must run end-to-end with a local model so the build never blocks on a rate limit.
- **Embeddings run locally.** No paid embedding API. `sentence-transformers` into `pgvector`.
- Must run fully offline for development: `supabase start` + `pnpm dev` + `uvicorn` + `ollama serve`.
- Multi-tenant and multi-board from commit one. Never build CBSE-only and "add boards later."

---

## 5. Repository structure

```
acharya/
├── CLAUDE.md
├── PROGRESS.md
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA-MODEL.md
│   ├── AI-GATEWAY.md          # redaction, routing, schema validation, logging
│   ├── SAFETY.md              # what ACHARYA refuses to do, and why
│   ├── FRAMEWORK-MAP.md       # CBSE / IB / Cambridge / AP outcome model
│   └── DEMO-SCRIPT.md         # the 12-minute teacher-facing walkthrough
├── web/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (app)/
│   │   │   ├── dashboard/
│   │   │   ├── setu/{concepts,outcomes,alignment,units,coverage,transitions}/
│   │   │   ├── prashna/{bank,generate,blueprints,papers,calibration}/
│   │   │   ├── saarthi/{plan,worksheet,rubric,message,history}/
│   │   │   ├── darpan/{observations,inputs,descriptors,reports}/
│   │   │   └── uday/{scheme,activities,hours,projects,cpd}/
│   │   ├── (parent)/portal/
│   │   ├── (student)/portal/
│   │   └── (public)/
│   ├── components/{ui,shared,setu,prashna,saarthi,darpan,uday}/
│   ├── lib/{supabase,rbac,audit,ai,redact,approval,validation}/
│   └── tests/
├── supabase/
│   ├── migrations/            # 0001_tenancy.sql … 0009_seed_demo.sql
│   └── seed/
├── worker/
│   ├── app/{main.py,gateway.py,redact.py,embed.py,align.py,items.py,papers.py,descriptors.py,pdf.py}
│   ├── prompts/               # versioned templates + JSON schemas
│   ├── templates/             # WeasyPrint HTML
│   └── tests/
└── .github/workflows/ci.yml
```

---

## 6. Data model

Every table gets `id uuid default gen_random_uuid()`, `school_id uuid not null`, `created_at timestamptz default now()`, and an RLS policy.

### 6.1 Tenancy and academic structure (migration 0001)

```sql
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text unique not null,
  city text, state text, timezone text default 'Asia/Kolkata',
  student_count int
);

create table frameworks (                  -- the four boards
  id uuid primary key default gen_random_uuid(),
  code text unique not null,               -- 'CBSE','IB_MYP','IB_DP','CAMB_PRIMARY','CAMB_LOWER_SEC','IGCSE','AP'
  name text not null,
  stage_model text                         -- 'foundational_preparatory_middle_secondary', 'myp_years', etc.
);

create table school_frameworks (
  school_id uuid references schools(id),
  framework_id uuid references frameworks(id),
  grades text[] not null,                  -- which grades run this framework
  primary key (school_id, framework_id)
);

create type app_role as enum (
  'super_admin','principal','academic_head','board_coordinator','hod','teacher',
  'ct_ai_lead','exam_officer','parent','student'
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id),
  full_name text not null, role app_role not null,
  framework_id uuid references frameworks(id),   -- for board_coordinator
  subject_id uuid,                               -- for hod
  is_active boolean default true
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null, name text not null, code text not null,
  unique (school_id, code)
);

create table sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  grade text not null,                     -- 'Nursery','1'..'12'
  section text not null,
  framework_id uuid not null references frameworks(id),
  unique (school_id, grade, section)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  admission_no text not null, full_name text not null, dob date not null,
  section_id uuid references sections(id),
  previous_framework_id uuid references frameworks(id),   -- for board-transition gap reports
  is_active boolean default true,
  unique (school_id, admission_no)
);

create table teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  teacher_id uuid references profiles(id),
  section_id uuid references sections(id),
  subject_id uuid references subjects(id),
  academic_year text not null,
  unique (teacher_id, section_id, subject_id, academic_year)
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null, full_name text not null,
  phone text, email text, auth_user_id uuid references auth.users(id)
);

create table student_guardians (
  student_id uuid references students(id) on delete cascade,
  guardian_id uuid references guardians(id) on delete cascade,
  relation text, is_primary boolean default false,
  primary key (student_id, guardian_id)
);
```

### 6.2 Audit chain and AI gateway (migration 0002) — build before any feature

```sql
create table audit_events (
  id bigserial primary key,
  school_id uuid not null, actor_id uuid, actor_role app_role,
  action text not null, entity_type text not null, entity_id uuid,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  prev_hash text, hash text not null
);
-- hash = sha256( prev_hash || school_id || action || entity_id || payload::text || occurred_at )
-- Insert only.

create table prompt_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,                       -- 'item.competency.v1','descriptor.hpc.v2'
  version int not null,
  system_prompt text not null,
  user_template text not null,
  output_schema jsonb not null,            -- JSON schema; output is validated against this
  notes text,
  is_active boolean default true,
  unique (key, version)
);

create table generation_log (
  id bigserial primary key,
  school_id uuid not null,
  actor_id uuid,
  template_key text not null, template_version int not null,
  provider text not null, model text not null,
  redacted_prompt_hash text not null,      -- hash only. NEVER store the raw prompt.
  redaction_count int not null,            -- how many PII spans were removed
  input_tokens int, output_tokens int, latency_ms int,
  output jsonb,
  validation_result text check (validation_result in ('valid','retried_valid','invalid')),
  artifact_type text, artifact_id uuid,
  created_at timestamptz default now()
);

create table approvals (                   -- the human-in-the-loop ledger
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  artifact_type text not null,             -- 'item','paper','lesson_plan','worksheet','rubric','message','descriptor'
  artifact_id uuid not null,
  generated_version jsonb not null,        -- what the model produced
  final_version jsonb not null,            -- what the human approved
  edit_distance numeric,                   -- how much the teacher changed
  approved_by uuid not null references profiles(id),
  approved_at timestamptz not null default now(),
  unique (artifact_type, artifact_id)
);
```

**Redaction rule (worker, `redact.py`):** before any prompt is constructed, replace student and guardian names, admission numbers, phone numbers, email addresses and dates of birth with stable placeholders (`[STUDENT_1]`, `[GUARDIAN_1]`). Placeholders are re-substituted **after** the model returns, in the application layer. A unit test asserts that no seeded student name ever appears in a constructed prompt.

**Approval trigger:** any artifact table with a `published`/`assigned` state cannot enter that state without a matching `approvals` row. Database-enforced.

### 6.3 SETU — the multi-board curriculum spine (migration 0003)

```sql
create table concepts (                    -- the canonical, board-agnostic node
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  subject_id uuid references subjects(id),
  title text not null,                     -- 'Photosynthesis: light-dependent reactions'
  description text,
  stage text,                              -- 'preparatory','middle','secondary'
  parent_id uuid references concepts(id),
  embedding vector(384)
);

create table learning_outcomes (           -- one row per outcome per framework
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  framework_id uuid not null references frameworks(id),
  subject_id uuid references subjects(id),
  grade text not null,
  ref_code text not null,                  -- 'CBSE.SCI.10.4.2', 'MYP.SCI.C.iii', 'CAMB.SCI.7Bp.03', 'AP.BIO.3.4'
  statement text not null,
  cognitive_level text,                    -- Bloom: remember/understand/apply/analyse/evaluate/create
  source_document text,
  embedding vector(384),
  unique (school_id, framework_id, ref_code)
);

create table outcome_concepts (            -- LO → canonical concept
  learning_outcome_id uuid references learning_outcomes(id) on delete cascade,
  concept_id uuid references concepts(id) on delete cascade,
  confidence numeric,                      -- from embedding similarity
  method text check (method in ('embedding_suggested','llm_suggested','human_confirmed')),
  confirmed_by uuid references profiles(id), confirmed_at timestamptz,
  primary key (learning_outcome_id, concept_id)
);
-- AI proposes. A human confirms. Only 'human_confirmed' links count for coverage and generation.

create table cross_alignments (            -- convenience view of LO ↔ LO across frameworks
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  outcome_a uuid references learning_outcomes(id),
  outcome_b uuid references learning_outcomes(id),
  similarity numeric,
  relation text check (relation in ('equivalent','partial','prerequisite','extends')),
  confirmed_by uuid, confirmed_at timestamptz
);

create table units (                       -- a teachable unit of work
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  title text not null,
  subject_id uuid references subjects(id),
  grade text not null,
  framework_id uuid references frameworks(id),
  planned_hours numeric, sequence_no int,
  academic_year text not null
);

create table unit_outcomes (
  unit_id uuid references units(id) on delete cascade,
  learning_outcome_id uuid references learning_outcomes(id) on delete cascade,
  primary key (unit_id, learning_outcome_id)
);

create table coverage (                    -- computed: taught / assessed / evidenced per outcome
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  learning_outcome_id uuid references learning_outcomes(id),
  section_id uuid references sections(id),
  academic_year text not null,
  taught_on date, assessed_count int default 0, last_assessed_on date,
  unique (learning_outcome_id, section_id, academic_year)
);

create table transition_reports (          -- student moving between boards
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid references students(id),
  from_framework_id uuid references frameworks(id),
  to_framework_id uuid references frameworks(id),
  target_grade text not null,
  gaps jsonb not null,                     -- outcomes in target framework with no covered equivalent
  generated_at timestamptz default now(), reviewed_by uuid
);
```

**Alignment pipeline (worker, `align.py`):**
1. Ingest a framework document (PDF or CSV) → extract outcomes with `ref_code` and `statement`.
2. Embed all outcomes locally with `sentence-transformers`.
3. For each outcome, retrieve top-k nearest concepts via `pgvector`. Above 0.82 similarity, propose `embedding_suggested`.
4. For ambiguous cases (0.65–0.82), send a **redacted, outcome-only** prompt to the model asking for a relation label with justification, schema-validated. Mark `llm_suggested`.
5. Everything lands in a **human confirmation queue**. Nothing is used for generation or coverage until `human_confirmed`.

### 6.4 PRASHNA (migration 0004)

```sql
create type item_type as enum (
  'mcq','assertion_reason','case_based','source_based','short_answer','long_answer',
  'numerical','diagram','competency_cluster'
);

create table items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  subject_id uuid references subjects(id),
  grade text not null,
  item_type item_type not null,
  stem text not null,
  stimulus text,                           -- the case / source passage, for case-based items
  options jsonb,                           -- for MCQ
  answer_key jsonb not null,
  marking_scheme text,
  marks numeric not null,
  cognitive_level text not null,           -- Bloom
  difficulty_intended text check (difficulty_intended in ('easy','medium','hard')),
  origin text not null check (origin in ('ai_generated','teacher_written','imported')),
  status text default 'draft' check (status in ('draft','pending_review','approved','retired')),
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id), approved_at timestamptz
);
-- An item cannot reach 'approved' without an approvals row. DB trigger.

create table item_outcomes (               -- MANDATORY: every item ties to at least one outcome
  item_id uuid references items(id) on delete cascade,
  learning_outcome_id uuid references learning_outcomes(id),
  primary key (item_id, learning_outcome_id)
);
-- Trigger: an item cannot be saved with zero rows here.

create table item_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  item_id uuid references items(id) on delete cascade,
  version int not null, body jsonb not null,
  edited_by uuid, edited_at timestamptz default now()
);

create table blueprints (                  -- the paper design rules per framework
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  framework_id uuid references frameworks(id),
  subject_id uuid references subjects(id),
  grade text not null,
  label text not null,                     -- 'CBSE Class 10 Science, Board Pattern 2026'
  total_marks numeric not null, duration_minutes int,
  composition jsonb not null,
  -- e.g. {"competency_pct":50,"objective_pct":20,"long_answer_pct":30,
  --       "bloom_mix":{"apply":0.3,"analyse":0.25},"sections":[...]}
  is_active boolean default true
);

create table papers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  blueprint_id uuid references blueprints(id),
  section_id uuid references sections(id),
  title text not null,
  exam_kind text check (exam_kind in ('unit_test','midterm','preboard','main_board_practice','improvement_practice','mock')),
  scheduled_on date,
  status text default 'draft' check (status in ('draft','pending_review','approved','printed')),
  approved_by uuid, approved_at timestamptz
);

create table paper_items (
  paper_id uuid references papers(id) on delete cascade,
  item_id uuid references items(id),
  section_label text, q_no text, marks numeric,
  primary key (paper_id, item_id)
);

create table responses (                   -- for difficulty calibration
  id bigserial primary key,
  school_id uuid not null,
  paper_id uuid references papers(id),
  item_id uuid references items(id),
  student_id uuid references students(id),
  marks_obtained numeric, max_marks numeric
);

create table item_stats (                  -- computed nightly
  item_id uuid primary key references items(id) on delete cascade,
  school_id uuid not null,
  attempts int, facility numeric,          -- proportion scoring full marks
  discrimination numeric,                  -- top third vs bottom third
  difficulty_observed text,
  last_computed_on date
);
```

**Item generation flow:**
1. Teacher picks subject, grade, framework, one or more learning outcomes, item type and count.
2. Worker builds a prompt from `prompt_templates` containing the outcome statements, the chapter text if supplied, the required item type and Bloom level, and a strict JSON schema. **No student data is ever in this prompt**, so redaction is trivially satisfied.
3. Output is schema-validated. Invalid → one retry → surfaced as failure.
4. Items land in `status = 'draft'`, visible only to the requesting teacher.
5. Teacher edits, then submits for HOD review. HOD approves → item enters the shared bank with an `approvals` row storing both versions and the edit distance.
6. **Paper generation** is constraint satisfaction, not generation: select approved items from the bank that satisfy the blueprint's marks, competency percentage, Bloom mix and outcome coverage. If the bank cannot satisfy the blueprint, report exactly which slot is short and offer to generate candidates for it.

### 6.5 SAARTHI (migration 0005)

```sql
create table artifacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  kind text not null check (kind in ('lesson_plan','worksheet','rubric','parent_message','activity','remediation_set','revision_sheet')),
  title text not null,
  body jsonb not null,
  subject_id uuid references subjects(id),
  grade text, framework_id uuid references frameworks(id),
  unit_id uuid references units(id),
  section_id uuid references sections(id),
  differentiation_level text check (differentiation_level in ('support','core','extension')),
  language text default 'en',              -- 'en','hi'
  origin text check (origin in ('ai_generated','teacher_written')),
  status text default 'draft' check (status in ('draft','approved','shared')),
  created_by uuid references profiles(id),
  approved_by uuid, approved_at timestamptz
);

create table artifact_outcomes (           -- MANDATORY linkage, same rule as items
  artifact_id uuid references artifacts(id) on delete cascade,
  learning_outcome_id uuid references learning_outcomes(id),
  primary key (artifact_id, learning_outcome_id)
);

create table artifact_shares (
  artifact_id uuid references artifacts(id) on delete cascade,
  shared_with_role app_role,
  shared_with_subject uuid,
  shared_at timestamptz default now(),
  primary key (artifact_id, shared_with_role)
);
```

SAARTHI generators, all outcome-linked and all approval-gated:
- **Lesson plan** for a unit: objectives, hook, sequence, checks for understanding, differentiation, closure, homework
- **Differentiated worksheet**: same outcome at support / core / extension levels
- **Rubric** from an outcome and a task description, with descriptor bands
- **Parent message** drafted from teacher-supplied notes, PII redacted then re-substituted on output, warm and specific, never diagnostic
- **Remediation set** for outcomes the class scored poorly on, built from the approved item bank first, generation only for gaps
- **Revision sheet** for a set of outcomes ahead of an exam

### 6.6 DARPAN (migration 0006)

```sql
create table hpc_stages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  stage text not null check (stage in ('foundational','preparatory','middle','secondary')),
  grades text[] not null,
  template jsonb not null                  -- stage-specific section structure
);

create table hpc_domains (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  stage text not null,
  domain text not null,                    -- 'cognitive','affective','socio_emotional','psychomotor'
  descriptor_key text not null, label text not null
);

create table observations (                -- teacher-written, never system-inferred
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid references students(id),
  teacher_id uuid references profiles(id),
  domain text, context text,               -- 'group work','presentation','lab','sport'
  note text not null,
  learning_outcome_id uuid references learning_outcomes(id),
  observed_on date not null
);

create table hpc_inputs (                  -- the 360-degree part
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid references students(id),
  term text not null,
  source text not null check (source in ('self','peer','parent','teacher')),
  submitted_by uuid,                       -- null for anonymised peer input
  responses jsonb not null,
  submitted_at timestamptz default now()
);

create table hpc_descriptors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid references students(id),
  term text not null, domain text not null,
  generated_text text,                     -- AI draft
  final_text text,                         -- teacher-approved
  approved_by uuid references profiles(id), approved_at timestamptz,
  unique (student_id, term, domain)
);

create table hpc_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid references students(id),
  term text not null, stage text not null,
  file_path text, generated_at timestamptz,
  released_to_parent_at timestamptz,
  unique (student_id, term)
);
```

**Descriptor generation rule, and it matters:** the model receives **redacted evidence only** — observation notes with names stripped, outcome-linked assessment performance, and the 360 inputs. It returns a draft narrative in a strict schema: strengths, growth areas, and a next step. It **never** receives or produces a comparison to other students, a diagnosis, a personality claim, or a prediction. A teacher edits and approves every descriptor before any parent sees it. Unapproved descriptors cannot be included in a report; database-enforced.

### 6.7 UDAY (migration 0007)

```sql
create table ct_ai_units (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  grade text not null check (grade in ('3','4','5','6','7','8')),
  sequence_no int not null,
  title text not null, big_idea text,
  planned_hours numeric not null,
  strand text check (strand in ('computational_thinking','data_literacy','ai_concepts','ethics_and_bias','applied_project'))
);

create table ct_ai_activities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  unit_id uuid references ct_ai_units(id) on delete cascade,
  title text not null,
  mode text not null check (mode in ('unplugged','plugged','hybrid')),
  duration_minutes int not null,
  materials text, instructions_md text not null,
  assessment_note text
);

create table ct_ai_hours_ledger (          -- proves the 50 / 100 hour requirement
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  section_id uuid references sections(id),
  academic_year text not null,
  activity_id uuid references ct_ai_activities(id),
  delivered_on date not null, minutes int not null,
  teacher_id uuid references profiles(id),
  evidence_path text
);

create table ct_ai_projects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid references students(id),
  unit_id uuid references ct_ai_units(id),
  title text, artefact_path text,
  rubric_scores jsonb, teacher_comment text,
  assessed_by uuid, assessed_on date
);

create table cpd_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  teacher_id uuid references profiles(id),
  activity text not null,                  -- 'District Level Deliberation','CBSE CoE workshop','in-house'
  theme text default 'Computational Thinking and Understanding AI',
  hours numeric not null, completed_on date,
  certificate_path text
);
```

**Hours dashboard:** live per section — hours delivered against the 50-hour (Classes 3–5) or 100-hour (Classes 6–8) annual requirement, with a projected shortfall and an inspection-ready PDF.

### 6.8 RLS pattern

```sql
alter table items enable row level security;

create policy tenant_isolation on items
  for all using (school_id = (auth.jwt() ->> 'school_id')::uuid);

create policy item_visibility on items for select using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and (
    status = 'approved'                                  -- shared bank
    or created_by = auth.uid()                           -- own drafts
    or (auth.jwt() ->> 'role') in ('principal','academic_head','exam_officer')
    or ((auth.jwt() ->> 'role') = 'hod'
        and subject_id = (auth.jwt() ->> 'subject_id')::uuid)
  )
);

-- DARPAN: a teacher sees only students they teach
create policy observation_scope on observations for select using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and (
    (auth.jwt() ->> 'role') in ('principal','academic_head')
    or student_id in (
      select st.id from students st
      join teaching_assignments ta on ta.section_id = st.section_id
      where ta.teacher_id = auth.uid())
  )
);

-- parents see only their own child, and only released reports
create policy parent_report_scope on hpc_reports for select using (
  school_id = (auth.jwt() ->> 'school_id')::uuid
  and released_to_parent_at is not null
  and student_id in (
    select sg.student_id from student_guardians sg
    join guardians g on g.id = sg.guardian_id
    where g.auth_user_id = auth.uid())
);
```

Write **one negative test per role per sensitive table.**

---

## 7. Design system

This is used by teachers, often on a phone, between periods, with four minutes to spare. Speed and low friction beat elegance.

- **Theme:** light default, dark available.
- **Palette:** warm neutral base; one deep saffron-amber primary (`#B4530A`); semantic colour only for state — amber = pending review, red = rejected or overdue, green = approved. Never decorative.
- **Type:** Inter for UI; a serif for printed papers and HPC reports only. Tabular numerals in mark grids.
- **Density:** medium. Generous tap targets on mobile, compact tables on desktop.
- **Motion:** `motion/react` only for state feedback — item card enter/exit, streaming generation shimmer, approval confirmation. No parallax, no scroll effects, no 3D. Gate behind `useReducedMotion()`.
- **The signature element:** the **approval card.** Generated draft on the left, teacher's edited version on the right, changed spans highlighted, the linked learning outcome pinned at the top, and one large Approve button. It makes "human in the loop" visible rather than claimed, and it is the screen you demo first.
- **Second signature element:** the **outcome chip.** Every item, worksheet, plan and descriptor carries a chip showing its framework and outcome code. Click it to see the outcome statement and every other artifact tied to it. This is what proves alignment.
- **Bilingual:** all parent-facing and student-facing screens in English and Hindi. Teacher screens English, with Hindi output supported for generated artifacts.
- **Print styles:** papers, worksheets, HPC reports and schemes of work must print cleanly to A4.
- **Accessibility:** responsive to 360px, real `<button>`/`<a>`, visible focus rings, logical tab order, semantic headings, contrast ≥ 4.5:1.

---

## 8. Phase plan

### Phase 0 — Foundation and AI gateway (3 sessions)

**Objective:** a multi-tenant, multi-board shell where no model call can leak student data and no generated artifact can reach a child unapproved.

Tasks:
1. Scaffold `web/` and `worker/`; init Supabase locally with `pgvector`; init Ollama for local dev.
2. Migrations 0001 (tenancy, four frameworks seeded) and 0002 (audit, prompt templates, generation log, approvals).
3. Auth with `school_id`, `role`, `framework_id`, `subject_id` as JWT custom claims.
4. `lib/rbac` — single `can(user, action, resource)`; all UI gating routes through it.
5. `lib/audit` — hash-chained `logEvent()`.
6. **AI gateway** (`worker/app/gateway.py`): provider abstraction (Gemini Flash → Groq → Ollama), template loading by key and version, JSON schema validation with one retry, structured logging to `generation_log`. Provider chosen by one env variable.
7. **Redaction layer** (`worker/app/redact.py`): PII detection and placeholder substitution before prompt construction; re-substitution after response.
8. **Approval layer** (`lib/approval`): generic artifact approval flow, `approvals` row on approve, edit-distance computation.
9. Approval card component and outcome chip component, wired to a seeded dummy artifact.
10. App shell: sidebar with five modules, framework switcher, role badge.
11. CI: typecheck, lint, unit tests, `supabase db lint`.

Deliverables: running `web/` + `worker/` · migrations 0001–0002 · rbac, audit, approval libs · **AI gateway with provider fallback** · **redaction layer** · approval card · outcome chip · app shell · `docs/ARCHITECTURE.md`, `docs/AI-GATEWAY.md`, `docs/SAFETY.md` v1 · green CI.

Acceptance tests:
- Two seeded tenants; a user in tenant A gets zero rows from tenant B.
- **Redaction test:** for 50 seeded students, no student name, admission number, phone or DOB appears in any constructed prompt. Asserted by scanning the built prompt string.
- Gateway returns schema-valid output from the local Ollama model, and falls back correctly when the primary provider is unreachable.
- An artifact cannot enter `approved` without an `approvals` row (database rejects it).
- `verify_chain()` returns `OK` on 30 events and detects a tampered fixture.

---

### Phase 1 — SETU (4 sessions)

**Objective:** one concept graph, four boards mapped onto it, humans confirming every link.

Tasks:
1. Migration 0003.
2. **Framework ingestion**: CSV and PDF import for outcome sets, with column/section mapping. Seed real-shaped outcome sets for CBSE (Classes 3–10, Science, Maths, Social Science, English), IB MYP and DP (two subjects), Cambridge Primary and Lower Secondary (two subjects), AP (one subject). All synthetic in wording, realistic in structure.
3. Local embedding pipeline (`sentence-transformers` → `pgvector`) for concepts and outcomes.
4. Concept graph CRUD with parent-child hierarchy.
5. **Alignment engine**: nearest-neighbour proposals above 0.82; LLM-assisted relation labelling for the 0.65–0.82 band, schema-validated; everything into a confirmation queue.
6. **Human confirmation queue UI**: side-by-side outcome statements, similarity score, relation dropdown, bulk confirm, keyboard-driven.
7. **Cross-alignment view**: pick any outcome, see equivalents in the other three frameworks.
8. Units and pacing: build a unit, attach outcomes across frameworks, sequence across the year.
9. **Coverage dashboard**: per section, per outcome — taught, assessed, last assessed, gaps.
10. **Board transition gap report**: given a student's previous framework and target grade, list target-framework outcomes with no confirmed covered equivalent. Export as PDF for the parent meeting.
11. Multi-board planning view: a teacher taking Grade 9 CBSE and Grade 9 IGCSE sees one plan with both outcome sets attached.

Deliverables: migration 0003 · framework importer · local embedding pipeline · alignment engine · confirmation queue · cross-alignment view · units and pacing · coverage dashboard · **transition gap report PDF** · multi-board planning view · pytest suite for alignment.

Acceptance tests:
- Import 400 outcomes across four frameworks; every one embedded and searchable.
- Alignment fixture with 60 known cross-framework equivalents: ≥ 80% surfaced in the top-3 proposals, zero auto-confirmed without a human.
- Coverage and generation both **ignore** unconfirmed links; asserted by a test that adds an `embedding_suggested` link and shows coverage unchanged.
- Transition report for a seeded Cambridge → CBSE Class 9 student lists the correct planted gaps.

---

### Phase 2 — PRASHNA (4 sessions)

**Objective:** a teacher makes a blueprint-compliant competency paper in under ten minutes.

Tasks:
1. Migration 0004.
2. Prompt templates for each item type, each with a strict JSON schema: MCQ, assertion-reason, case-based, source-based, short answer, long answer, numerical, competency cluster.
3. **Generation flow**: select outcomes → item type → count → optional chapter text upload → generate → schema validate → land as drafts.
4. Item editor (TipTap) with stimulus, options, answer key, marking scheme, marks, Bloom level.
5. **Mandatory outcome linkage** enforced by trigger.
6. HOD review queue with approve, request changes, reject. `approvals` row on approve.
7. **Blueprint builder**: composition rules per framework (CBSE 2026 board pattern seeded: 50% competency, 20% objective, 30% long answer; plus IGCSE, MYP and AP patterns).
8. **Paper assembly as constraint satisfaction**: pick approved items satisfying marks, competency percentage, Bloom mix and outcome coverage. When the bank cannot satisfy a slot, report the exact shortfall and offer targeted generation.
9. Paper export to PDF: question paper, answer key, marking scheme, blueprint compliance sheet.
10. Marks import from CSV → `responses`.
11. **Difficulty calibration** nightly: facility and discrimination per item, observed difficulty compared to intended, flagging items that behave differently from their label.
12. **Two-exam support**: from a main-exam paper, generate a matched improvement-exam paper covering the same outcomes at the same blueprint with different items.
13. Bank browser: filter by outcome, framework, Bloom, type, difficulty, approval state.

Deliverables: migration 0004 · 8 item-type templates with schemas · generation flow · item editor · HOD review queue · blueprint builder with 4 seeded patterns · **paper assembly engine** · paper + key + marking scheme + compliance sheet PDFs · marks import · calibration job · improvement-paper generator · bank browser.

Acceptance tests:
- Generate 20 case-based items for a seeded outcome: all schema-valid, all outcome-linked, all landing as `draft`.
- An item saved with zero outcome links is rejected by the database.
- Paper assembly against the seeded CBSE 2026 blueprint produces a paper within ±2 marks of target and within ±3% of the competency percentage, or reports the exact shortfall.
- An item cannot reach `approved` without an `approvals` row.
- Calibration on seeded response data flags the 4 planted mislabelled items.
- Improvement paper covers the same outcome set as its main paper with zero item overlap.

---

### Phase 3 — SAARTHI (3 sessions)

**Objective:** the tool a teacher opens every day instead of a free chatbot.

Tasks:
1. Migration 0005.
2. Prompt templates with schemas for: lesson plan, differentiated worksheet (support/core/extension), rubric, parent message, activity, remediation set, revision sheet.
3. Generation UI with streaming, always starting from a selected unit or outcome, never a blank prompt box.
4. **Mandatory outcome linkage** enforced by trigger.
5. Approval and share flow; approved artifacts can be shared to a subject department.
6. **Parent message generator**: teacher supplies notes, redaction strips names before the call, placeholders re-substituted on output; tone constrained to specific and warm, with a hard prohibition on diagnostic or comparative language in the system prompt and a post-validation check.
7. **Remediation set builder**: given a class's weak outcomes from `responses`, assemble practice from the approved item bank first, generate only for genuine gaps.
8. Hindi output support for worksheets and parent messages.
9. Artifact history with version diff, showing the teacher what they changed from the draft.
10. **My time saved** panel: artifacts approved, drafts reused, estimated hours, per teacher and per department. This is the number the school leadership will care about.

Deliverables: migration 0005 · 7 generator templates · streaming generation UI · approval and share flow · parent message generator with redaction round-trip · remediation builder · Hindi output · version diff · time-saved panel.

Acceptance tests:
- Parent message round-trip: a message about a seeded student contains the real name in the final output and never in the constructed prompt (both asserted).
- A generated worksheet without an outcome link cannot be saved.
- Remediation builder for a seeded weak outcome uses bank items first; generation only triggers for the outcome with an empty bank.
- Hindi worksheet renders correctly in the PDF with proper Devanagari shaping.

---

### Phase 4 — DARPAN (3 sessions)

**Objective:** an HPC that a teacher can actually finish for 40 children.

Tasks:
1. Migration 0006. Seed stage templates and domain descriptors for all four stages.
2. **Quick observation capture**: mobile-first, 20 seconds, optional outcome tag, optional context tag.
3. **360-degree input collection**: student self-assessment form, anonymised peer input, parent input form (tokenised link, no login), teacher input. Bilingual.
4. **Descriptor drafting**: redacted evidence in, strict-schema narrative out (strengths, growth areas, next step). Hard prohibitions in the system prompt against comparison, diagnosis, personality claims and prediction, plus a post-validation check that rejects output containing comparative or clinical language.
5. Teacher edit and approve per domain per student. Unapproved descriptors cannot enter a report.
6. **Report generator** (WeasyPrint): stage-specific HPC PDF with scholastic, co-scholastic, personal-social and 360 sections.
7. Release-to-parent workflow with a release date and a parent portal view.
8. **Class completion dashboard**: for a teacher, how many descriptors remain, sorted by what's blocking.
9. Evidence attachment: photos of project work, linked to observations, consent-checked before inclusion.

Deliverables: migration 0006 · stage templates · quick observation capture · four 360 input forms (bilingual) · descriptor drafting with guardrails · approve flow · **HPC report PDF per stage** · release workflow · parent portal view · completion dashboard.

Acceptance tests:
- Descriptor prompt for a seeded student contains no name, admission number or DOB.
- A descriptor whose draft contains comparative language ("better than", "one of the weakest") is rejected by post-validation; a fixture asserts this.
- A report cannot generate while any domain descriptor is unapproved.
- Parent portal shows only released reports for that parent's own child; a test asserts a parent cannot fetch another child's report.
- Peer input is anonymous to the receiving student and attributed only in the teacher view.

---

### Phase 5 — UDAY (2 sessions)

**Objective:** the AI & CT mandate delivered and provable.

Tasks:
1. Migration 0007.
2. Seed a full scheme of work: Classes 3–5 at 50 hours per year, Classes 6–8 at 100 hours per year, across the five strands (computational thinking, data literacy, AI concepts, ethics and bias, applied project).
3. Activity library with plugged and unplugged variants for every unit, so the programme runs without a lab.
4. **Hours ledger**: log delivery per section, with evidence upload.
5. **Hours dashboard**: delivered vs required, projected shortfall, per section and per grade.
6. Project assessment with rubrics; student portal for artefact upload.
7. **Teacher CPD tracker**: District Level Deliberations, CBSE CoE workshops, in-house sessions, hours and certificates.
8. **Programme evidence pack PDF**: scheme of work, hours delivered, sample student work, CPD coverage, ready for an inspection or an affiliation file.
9. Ethics and bias strand built with age-appropriate, non-technical activities, since this is the part schools most often skip.

Deliverables: migration 0007 · seeded 50/100-hour scheme of work · plugged and unplugged activity library · hours ledger and dashboard · project rubrics and student upload · CPD tracker · **programme evidence pack PDF**.

Acceptance tests:
- Hours dashboard for a seeded Class 6 section at 64 delivered hours shows a 36-hour shortfall and the correct projection.
- Every unit has at least one unplugged activity variant, asserted by a test.
- Evidence pack PDF generates with all five sections for a seeded grade.

---

### Phase 6 — Demo hardening, deploy, docs (2 sessions)

Tasks:
1. Seed the full demo tenant (Section 9): four boards, one academic year of activity.
2. Performance: index every foreign key and RLS predicate column; `pgvector` index on both embedding columns; generation streams within 2 seconds to first token on the free tier.
3. Playwright suite covering the 12-minute demo path.
4. Accessibility audit: axe clean on every route; keyboard-only walkthrough; 360px viewport pass.
5. Deploy web to Vercel, worker to Render, DB to Supabase `ap-south-1`.
6. Finalise `README.md`, `docs/DEMO-SCRIPT.md`, `docs/FRAMEWORK-MAP.md`, `docs/SAFETY.md`.
7. **Reset-demo** button (super_admin only) restoring seed state in under 45 seconds.
8. Screenshot pack: 12 annotated PNGs at 1440×900 plus 6 mobile screens at 390×844.
9. `docs/SAFETY.md` final, including the refusals section: no autonomous grading, no AI detection, no student profiling, no PII to models, nothing reaches a child unapproved. This is a sales document as much as a dev note.

Deliverables: seeded demo tenant · live URLs · Playwright suite · a11y report · all docs · reset-demo · screenshot pack.

Acceptance tests:
- A cold visitor logs in as `teacher@kalanjali.demo` and completes the demo script without a 500.
- Reset-demo restores identical state; the demo runs twice consecutively.
- Lighthouse ≥ 90 on performance and accessibility for the teacher dashboard.

---

## 9. Demo seed data spec (all fictional)

- **Tenant:** Kalanjali International School, Jaipur · slug `kalanjali` · 5,400 students, Nursery to Class 12.
- **Frameworks live:** CBSE (Classes 1–12), Cambridge Primary (1–5), Cambridge Lower Secondary (6–8), IGCSE (9–10), IB DP (11–12), AP (11–12 electives).
- **Structure:** 62 sections, 4 subjects fully modelled (Science, Mathematics, Social Science, English), 180 teachers.
- **Users (password `Demo@2026`):** `principal@`, `academic@`, `ibcoord@`, `cambcoord@`, `hod@`, `teacher@`, `ctlead@`, `exam@`, `parent@`, `student@` — all `@kalanjali.demo`.
- **SETU:** 400 learning outcomes across the four frameworks, 120 canonical concepts, 260 human-confirmed links, 40 pending in the queue, 60 planted cross-framework equivalents. One seeded student flagged as Cambridge Lower Secondary → CBSE Class 9 with 7 planted gaps.
- **PRASHNA:** 620 items in the bank (410 approved, 90 pending HOD review, 120 teacher drafts), spread across all 8 types; 4 blueprints; 12 papers including one main/improvement pair; response data for 6 papers with 4 planted mislabelled-difficulty items.
- **SAARTHI:** 180 artifacts across all 7 kinds, 140 approved with visible edit distances, 3 in Hindi. Time-saved panel showing a realistic figure per department.
- **DARPAN:** one term complete for two Class 6 sections — 380 observations, full 360 inputs, 240 approved descriptors, 4 unapproved to demonstrate the block, 2 released reports.
- **UDAY:** full scheme for Classes 3–8; Class 6 section at 64 of 100 hours with the shortfall visible; 18 student projects assessed; CPD records for 40 teachers.

Every name from a generated fictional list. No real school, student, teacher or published syllabus text.

---

## 10. Testing strategy

| Layer | Tool | Bar |
|---|---|---|
| Unit | Vitest | RBAC, approval gating, blueprint constraint solver, edit distance |
| Redaction | Vitest + pytest | No PII in any constructed prompt, ever |
| RLS negative | Vitest, service + anon clients | One test per role per sensitive table |
| Worker | pytest | Alignment, item schema validation, calibration, descriptor guardrails, PDF render |
| E2E | Playwright | Generate → edit → approve → assemble paper → export; HPC term cycle; transition report |
| Repo scan | Vitest | No AI-detection field or string; no auto-grade path |
| A11y | axe-playwright | Zero critical violations on every route |

**Non-negotiable tests** (a phase is incomplete without them):
1. Cross-tenant read returns zero rows.
2. No student PII appears in any constructed prompt.
3. No artifact reaches a published or assigned state without an `approvals` row.
4. Items and artifacts cannot be saved with zero outcome links.
5. Unconfirmed alignments never affect coverage or generation.
6. Descriptor post-validation rejects comparative, diagnostic and predictive language.
7. No AI-detection score exists in schema, API or UI.
8. No code path sets a final grade without a teacher action.
9. A parent cannot read another child's report.
10. Audit chain verification detects a tampered row.

---

## 11. Deployment

- Web → Vercel, project `acharya`, env from `.env.example`.
- Worker → Render free tier, Docker, health check `/healthz`. Generation runs async with job status; cold starts tolerated.
- DB → Supabase `ap-south-1`, `pgvector` enabled. Private storage buckets: `evidence`, `artifacts`, `papers`, `projects`, `cpd`. No public bucket.
- AI providers via env: `AI_PROVIDER=gemini|groq|ollama`, plus keys. Local dev defaults to `ollama`.
- Cron → `pg_cron`: item calibration `0 2 * * *`, coverage refresh `0 3 * * *`, hours projection `0 4 * * 1`, descriptor completion reminders `0 9 * * 1`.
- Secrets never committed. `.env.example` lists every key with a fake value.

---

## 12. Full deliverables inventory

At the end of Phase 6 the repository contains:

**Application**
1. Multi-tenant, four-framework Next.js 15 web app, 10 roles, bilingual parent and student surfaces
2. FastAPI worker: AI gateway, redaction, embeddings, alignment, item generation, paper assembly, descriptor drafting, PDF generation
3. 7 migrations with complete RLS coverage
4. 4 scheduled jobs

**Foundation** — provider-agnostic **AI gateway** with fallback chain · **PII redaction layer** with round-trip substitution · schema-validated output with retry · **approval ledger** storing generated and final versions with edit distance · hash-chained audit log · RBAC layer · **approval card** and **outcome chip** components

**SETU** — framework importer (CSV + PDF) · local embedding pipeline into pgvector · alignment engine with human confirmation queue · cross-framework equivalence view · units and pacing · coverage dashboard · **board-transition gap report PDF** · multi-board planning view

**PRASHNA** — 8 item-type generators with strict schemas · item editor · mandatory outcome linkage · HOD review queue · blueprint builder with CBSE 2026, IGCSE, MYP and AP patterns seeded · **constraint-based paper assembly** · question paper, answer key, marking scheme and **blueprint compliance sheet** PDFs · marks import · **difficulty calibration** · **matched improvement-exam generator** · bank browser

**SAARTHI** — 7 generators (lesson plan, differentiated worksheet, rubric, parent message, activity, remediation set, revision sheet) · streaming generation from a unit or outcome, never a blank box · approval and department sharing · **parent message with redaction round-trip** · remediation from bank first · Hindi output · version diff · **time-saved panel**

**DARPAN** — stage templates for all four stages · 20-second mobile observation capture · four 360 input forms (self, peer, parent, teacher), bilingual · **guarded descriptor drafting** · per-domain approve gate · **stage-specific HPC report PDF** · release-to-parent workflow · parent portal · class completion dashboard

**UDAY** — seeded 50/100-hour scheme of work for Classes 3–8 across five strands · plugged and unplugged activity library · hours ledger with evidence · **hours dashboard with shortfall projection** · project rubrics and student upload · teacher CPD tracker · **programme evidence pack PDF**

**Documents** — `README.md`, `ARCHITECTURE.md`, `DATA-MODEL.md`, `AI-GATEWAY.md`, `SAFETY.md` (with the refusals section), `FRAMEWORK-MAP.md`, `DEMO-SCRIPT.md`, `PROGRESS.md`, `.env.example`, CI workflow

**Pitch assets produced by the build** — live demo URL with reset · 12 desktop and 6 mobile annotated screenshots · five sample generated PDFs (competency paper with compliance sheet, HPC report, transition gap report, differentiated worksheet set, UDAY evidence pack) · the 12-minute demo script

---

## 13. `CLAUDE.md` — create this file in the repo root, verbatim

```markdown
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
```

---

## 14. SESSION 1 KICKOFF PROMPT (copy-paste into Claude Code)

```
You are building ACHARYA, a multi-tenant AI teaching platform for Indian schools running
CBSE, IB, Cambridge and AP simultaneously. I am pasting the master build document below.
Read it fully before writing anything.

Rules for this session:
1. First, create CLAUDE.md in the repo root using Section 13 verbatim.
2. Then execute PHASE 0 ONLY. Do not start Phase 1.
3. Before writing code, state your plan as numbered steps, each with a verify check,
   and list every assumption you are making. If anything is ambiguous, ask me first.
4. Follow the NON-NEGOTIABLE RULES in Section 2 absolutely. If a task appears to require
   breaking one, stop and ask.
5. Two things in Phase 0 are the product and must be airtight: the PII redaction layer
   (Section 2.2) and the approval gate (Section 2.1 rule 4). Enforce the approval gate in
   the database, not only in application code.
6. The AI gateway must run end to end against a local Ollama model so the build never
   blocks on a rate limit.
7. Prefer the simplest implementation that passes the acceptance tests. No speculative
   abstraction, no unrequested configurability.
8. End the session by running the Phase 0 acceptance tests, showing me the output,
   and writing PROGRESS.md.

Do not build any part of Phases 1-6 yet, even if it seems convenient.

--- MASTER DOCUMENT ---
[paste the entire ACHARYA master build document here]
```

---

## 15. RESUME PROMPT (every later session)

```
Continue the ACHARYA build.

1. Read CLAUDE.md and PROGRESS.md first.
2. Re-read Section 2 (non-negotiable rules) and the Phase [N] section of the master document.
3. State your plan as numbered steps with verify checks, plus any assumptions.
   Ask before choosing between interpretations.
4. Execute PHASE [N] ONLY.
5. Make surgical changes. Do not refactor or reformat code outside this phase's scope.
6. Finish by running the Phase [N] acceptance tests, showing the output, and updating
   PROGRESS.md.

If the previous phase's tests are failing, fix those first and tell me before proceeding.
```

---

## 16. Standing reminders for the build agent

- If a feature request during the build sounds like "grade it automatically", "detect if a student used AI", or "tell us which students are weak", the answer is no. Explain why, then offer the aligned alternative: draft feedback for teacher approval; declared use and process evidence; per-outcome mastery for the teacher, never a label on a child.
- The phrase to keep in mind for every UI decision: **outsource the doing, not the thinking.**
- Generic generation is a commodity. The moat is the confirmed outcome graph, the school's own approved item bank, and the approval ledger. Protect all three; never add a shortcut that bypasses them.
- Prefer boring, printable, outcome-tagged artifacts over clever features. The approval card, the outcome chip, the blueprint compliance sheet and the HPC report are the product.
- If scope must be cut, cut modules, not rigor. A perfect SETU plus PRASHNA wins a pilot. Five shallow modules win nothing.
