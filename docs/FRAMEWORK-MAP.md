# Framework map

How ACHARYA holds four boards in one spine (SETU, migration `0003_setu.sql`).

## Frameworks seeded

| Code | Board | Stages | Outcome code shape | Example |
|---|---|---|---|---|
| `CBSE` | CBSE (NCF 2023 competency framing) | Foundational → Secondary+ | `CBSE.<SUBJ>.<grade>.<unit>.<n>` | `CBSE.SCI.10.4.2` |
| `IB_MYP` | IB Middle Years Programme | MYP 1–5 | `IB_MYP.<SUBJ>.<criterion>.<strand>` | `IB_MYP.SCI.C.iii` |
| `IB_DP` | IB Diploma | DP1–2 | `IB_DP.<SUBJ>.<topic>.<sub>` | `IB_DP.BIO.2.1` |
| `CAMB_PRIMARY` | Cambridge Primary | Stages 1–6 | `CAMB_PRIMARY.<SUBJ>.<stage><strand>.<n>` | `CAMB_PRIMARY.SCI.5Bp.02` |
| `CAMB_LOWER_SEC` | Cambridge Lower Secondary | Stages 7–9 | as above | `CAMB_LOWER_SEC.SCI.7Bp.03` |
| `IGCSE` | Cambridge IGCSE | Grades 9–10 | `IGCSE.<syllabus>.<topic>.<n>` | `IGCSE.0610.6.2` |
| `AP` | Advanced Placement | Grades 11–12 | `AP.<SUBJ>.<grade>.<unit>.<n>` | `AP.BIO.11.3.4` |

400 outcomes across the four boards in the demo tenant (Section 9), 40 units,
1,200+ outcome→concept links, 60 human-confirmed cross-framework equivalents.

## The spine

```
frameworks ──< learning_outcomes >──< outcome_concepts >── concepts (board-agnostic)
                    │                                          │
                    ├──< unit_outcomes >── units (per subject/grade/year)
                    ├──< item_outcomes  >── items        (PRASHNA)
                    ├──< artifact_outcomes >── artifacts (SAARTHI)
                    └──< cross_alignments (outcome ↔ outcome, relation, similarity, status)
```

- **Concepts** are the board-neutral middle layer ("photosynthesis: inputs and
  outputs"). An outcome from any framework links to concepts; two outcomes that
  share concepts are candidates for equivalence.
- **Alignment engine** (`worker/app/align.py`): pgvector cosine similarity on
  `all-MiniLM-L6-v2` embeddings proposes links (`embedding_suggested`), the
  gateway optionally labels the relation (`equivalent` / `subset` / `superset` /
  `related`, `llm_suggested`). Only `human_confirmed` rows count for coverage,
  generation and transition reports. Nothing is confirmed by a model.
- **Coverage** (`coverage` table, refreshed nightly by pg_cron 03:00): taught
  (teacher marks) vs assessed (derived from `responses` via `item_outcomes`),
  per section per year. Aggregate views suppress cells under 5.

## Transition reports (SETU)

For a student moving frameworks (e.g. CBSE Class 8 → Cambridge Stage 9), the
report lists outcomes in the target framework with **no confirmed equivalent**
in the source framework, restricted to subjects the source framework offers —
the honest gap list, not a prediction about the child. Rendered by WeasyPrint;
the demo student KAL-2026-0007 has 7 gaps.

## Scoping by role

`board_coordinator` is scoped to `profiles.framework_id` (RLS + `can()`); an IB
coordinator sees IB DP outcomes, units, items and artifacts only. `hod` is
scoped to `profiles.subject_id` across frameworks.
