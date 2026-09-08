"""
Deterministic synthetic SETU seed generator (Section 9: all fictional, no
real syllabus text). Writes:
  supabase/seed/0006_setu.sql              -- Kalanjali concepts/outcomes/links/units/coverage/transition student
  worker/tests/fixtures/outcomes_400.csv   -- the same 400 outcomes, for the importer acceptance test
  worker/tests/fixtures/equivalents_60.csv -- 60 planted cross-framework equivalents (outcome_a, outcome_b, concept)

Guarantees: 400 outcomes, 120 concepts, 260 human_confirmed links, 40 pending
(embedding_suggested) links, 60 planted cross-framework equivalent pairs, and
exactly 7 planted gaps for a Cambridge Lower Secondary -> CBSE Class 9 student.
"""

import csv
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCHOOL = "a0000000-0000-0000-0000-000000000001"
TEACHER = "d0000000-0000-0000-0000-000000000001"
ACADEMIC = "d0000000-0000-0000-0000-000000000002"
YEAR = "2026-27"

SUBJECTS = {
    "SCI": ("b0000000-0000-0000-0000-000000000001", "Science"),
    "MATH": ("b0000000-0000-0000-0000-000000000002", "Mathematics"),
    "SST": ("b0000000-0000-0000-0000-000000000004", "Social Science"),
    "ENG": ("b0000000-0000-0000-0000-000000000005", "English"),
}

# 120 canonical concepts: 40 Science, 40 Maths, 20 SST, 20 English.
CONCEPTS = {
    "SCI": [
        "Cell structure and organelles", "Photosynthesis: light-dependent reactions", "Photosynthesis: Calvin cycle", "Cellular respiration",
        "Diffusion and osmosis", "Enzymes and reaction rates", "Human digestive system", "Circulatory system and blood",
        "Respiratory system", "Nervous system and reflexes", "Reproduction in flowering plants", "Human reproduction and adolescence",
        "Heredity and Mendelian inheritance", "DNA structure and replication", "Natural selection and adaptation", "Ecosystems and food webs",
        "Nutrient cycles", "Classification of living things", "Microorganisms and disease", "Immune response and vaccination",
        "States of matter and particle model", "Atoms, elements and compounds", "Periodic table trends", "Chemical bonding",
        "Acids, bases and salts", "Chemical reactions and equations", "Rates of reaction", "Metals and reactivity series",
        "Carbon compounds and hydrocarbons", "Electrolysis", "Forces and motion", "Newton's laws",
        "Work, energy and power", "Heat transfer and thermal energy", "Light: reflection and refraction", "Sound and waves",
        "Electric circuits", "Magnetism and electromagnetism", "Earth, moon and seasons", "Water cycle and weather",
    ],
    "MATH": [
        "Place value and number systems", "Fractions and decimals", "Ratio and proportion", "Percentages and applications",
        "Integers and negative numbers", "Rational and irrational numbers", "Exponents and surds", "Algebraic expressions",
        "Linear equations in one variable", "Simultaneous linear equations", "Quadratic equations", "Polynomials and factorisation",
        "Arithmetic and geometric sequences", "Functions and graphs", "Coordinate geometry", "Lines and angles",
        "Triangles and congruence", "Similarity and scale", "Pythagoras theorem", "Trigonometric ratios",
        "Circles: chords and tangents", "Area and perimeter", "Surface area and volume", "Constructions",
        "Transformations and symmetry", "Data collection and representation", "Measures of central tendency", "Probability of events",
        "Sets and Venn diagrams", "Logical reasoning and proof", "Vectors", "Matrices",
        "Differentiation basics", "Integration basics", "Financial mathematics", "Time, speed and distance",
        "Units and measurement", "Estimation and rounding", "Statistics: dispersion", "Inequalities",
    ],
    "SST": [
        "Early river valley civilisations", "Empires and trade routes", "Medieval kingdoms of the subcontinent", "Colonialism and resistance",
        "Freedom movement and independence", "The Constitution and fundamental rights", "Democracy and elections", "Local government and panchayats",
        "Judiciary and rule of law", "Landforms and plate tectonics", "Climate zones and monsoon", "Rivers and water resources",
        "Agriculture and food security", "Industries and resources", "Population and urbanisation", "Transport and communication",
        "Money, markets and livelihoods", "Globalisation and development", "Environmental conservation", "Disaster preparedness",
    ],
    "ENG": [
        "Reading for main idea and detail", "Inference and author's purpose", "Vocabulary in context", "Narrative writing",
        "Descriptive writing", "Argumentative and persuasive writing", "Letter and email writing", "Report and notice writing",
        "Summary and note-making", "Poetry: imagery and sound devices", "Drama: character and dialogue", "Prose: theme and setting",
        "Grammar: tenses and agreement", "Grammar: clauses and sentence types", "Punctuation and editing", "Speaking: presentations",
        "Listening comprehension", "Media literacy", "Research and citation", "Comparative reading across texts",
    ],
}

VERBS = {
    "remember": ["Recall", "List", "Identify"],
    "understand": ["Explain", "Describe", "Summarise"],
    "apply": ["Apply", "Use", "Demonstrate"],
    "analyse": ["Analyse", "Compare", "Distinguish"],
    "evaluate": ["Evaluate", "Justify", "Critique"],
    "create": ["Design", "Construct", "Propose"],
}
CONTEXTS = [
    "using a worked example from everyday life", "with reference to a labelled diagram", "through a short investigation",
    "in a real-world case study", "by interpreting given data", "with correct terminology", "in written and oral form",
    "using models or simulations",
]


def uid(*parts: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "acharya/setu/" + "/".join(parts)))


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def bloom(i: int) -> str:
    return list(VERBS.keys())[i % 6]


def statement(concept: str, i: int) -> str:
    level = bloom(i)
    verb = VERBS[level][i % 3]
    return f"{verb} {concept[0].lower() + concept[1:]} {CONTEXTS[i % len(CONTEXTS)]}."


# framework plan: (framework_code, subject_key, grades, per_cell, ref_template)
PLAN = [
    ("CBSE", "SCI", ["3", "4", "5", "6", "7", "8", "9", "10"], 8, "CBSE.SCI.{g}.{u}.{n}"),
    ("CBSE", "MATH", ["3", "4", "5", "6", "7", "8", "9", "10"], 8, "CBSE.MATH.{g}.{u}.{n}"),
    ("CBSE", "SST", ["3", "4", "5", "6", "7", "8", "9", "10"], 8, "CBSE.SST.{g}.{u}.{n}"),
    ("CBSE", "ENG", ["3", "4", "5", "6", "7", "8", "9", "10"], 8, "CBSE.ENG.{g}.{u}.{n}"),
    ("IB_MYP", "SCI", ["6", "7", "8", "9", "10"], 3, "MYP.SCI.{g}.{crit}.{n}"),
    ("IB_MYP", "MATH", ["6", "7", "8", "9", "10"], 3, "MYP.MATH.{g}.{crit}.{n}"),
    ("IB_DP", "SCI", ["11", "12"], 4, "DP.BIO.{g}.{u}.{n}"),
    ("IB_DP", "MATH", ["11", "12"], 4, "DP.MATH.{g}.{u}.{n}"),
    ("CAMB_PRIMARY", "SCI", ["1", "2", "3", "4", "5"], 3, "CAMB.SCI.{g}Bp.{nn}"),
    ("CAMB_PRIMARY", "MATH", ["1", "2", "3", "4", "5"], 3, "CAMB.MATH.{g}Nn.{nn}"),
    ("CAMB_LOWER_SEC", "SCI", ["6", "7", "8"], 5, "CAMB.SCI.{g}Bp.{nn}"),
    ("CAMB_LOWER_SEC", "MATH", ["6", "7", "8"], 5, "CAMB.MATH.{g}Ni.{nn}"),
    ("IGCSE", "SCI", ["9", "10"], 5, "IGCSE.0610.{g}.{n}"),
    ("IGCSE", "MATH", ["9", "10"], 5, "IGCSE.0580.{g}.{n}"),
    ("AP", "SCI", ["11", "12"], 9, "AP.BIO.{g}.{u}.{n}"),
]


def concept_for(subject: str, grade: str, slot: int) -> int:
    """Deterministically pick a concept index for a subject/grade/slot, spreading
    grades across the subject's concept list so the same concept recurs across
    frameworks at comparable grades (that recurrence is what makes cross-framework
    equivalents exist)."""
    pool = CONCEPTS[subject]
    g = int(grade)
    band_size = max(1, len(pool) // 12)
    start = ((g - 1) * band_size) % len(pool)
    return (start + slot * 3) % len(pool)


def main() -> None:
    concepts: list[dict] = []
    for subj, names in CONCEPTS.items():
        sid, _ = SUBJECTS[subj]
        parent_id = uid("concept-parent", subj)
        concepts.append({"id": parent_id, "subject_id": sid, "title": f"{SUBJECTS[subj][1]} (root)", "stage": None, "parent_id": None})
        for i, name in enumerate(names):
            stage = "preparatory" if i < len(names) // 3 else ("middle" if i < 2 * len(names) // 3 else "secondary")
            concepts.append({"id": uid("concept", subj, name), "subject_id": sid, "title": name, "stage": stage, "parent_id": parent_id})

    outcomes: list[dict] = []
    for fw, subj, grades, per_cell, tmpl in PLAN:
        for g in grades:
            for slot in range(per_cell):
                ci = concept_for(subj, g, slot)
                concept_name = CONCEPTS[subj][ci]
                n = slot + 1
                ref = tmpl.format(g=g, u=(slot // 3) + 1, n=n, crit="ABCD"[slot % 4], nn=f"{n:02d}")
                outcomes.append({
                    "id": uid("outcome", fw, ref),
                    "framework": fw,
                    "subject": subj,
                    "subject_id": SUBJECTS[subj][0],
                    "grade": g,
                    "ref_code": ref,
                    "statement": statement(concept_name, len(outcomes)),
                    "cognitive_level": bloom(len(outcomes)),
                    "concept_id": uid("concept", subj, concept_name),
                    "concept_name": concept_name,
                })
    assert len(outcomes) == 400, len(outcomes)

    # --- planted transition gaps: CBSE class 9 vs Cambridge Lower Secondary ---
    # Cambridge Lower Secondary offers Science and Maths only, so the report
    # compares those subjects; SST/English are reported as "not comparable".
    by_id = {c["id"]: c for c in concepts}
    gap_concepts: set[str] = set()
    for subj in ("SCI", "MATH"):
        cbse9 = [o for o in outcomes if o["framework"] == "CBSE" and o["grade"] == "9" and o["subject"] == subj]
        cbse9_concepts = sorted({o["concept_id"] for o in cbse9})
        subj_gaps = cbse9_concepts[: 4 if subj == "SCI" else 3]   # 4 + 3 = exactly 7 planted gaps
        gap_concepts |= set(subj_gaps)
        cover_list = [c for c in cbse9_concepts if c not in subj_gaps]
        camb_ls = [o for o in outcomes if o["framework"] == "CAMB_LOWER_SEC" and o["subject"] == subj]
        assert len(camb_ls) >= len(cover_list)
        # re-point Cambridge Lower Sec outcomes so that, between them, they cover
        # every non-gap CBSE-9 concept of the same subject and never a gap concept.
        for i, o in enumerate(camb_ls):
            if o["concept_id"] in gap_concepts or i < len(cover_list):
                target = cover_list[i % len(cover_list)]
                o["concept_id"] = target
                o["concept_name"] = by_id[target]["title"]
                o["statement"] = statement(o["concept_name"], 400 + i)
        for o in camb_ls:
            assert o["concept_id"] not in gap_concepts

    # --- links: 260 confirmed, 40 pending, rest unlinked ---
    # CBSE-9 and Cambridge Lower Sec must all be confirmed for the transition test.
    must_confirm = [o for o in outcomes if (o["framework"] == "CBSE" and o["grade"] == "9") or o["framework"] == "CAMB_LOWER_SEC"]
    others = [o for o in outcomes if o not in must_confirm]
    confirmed = must_confirm + others[: 260 - len(must_confirm)]
    remaining = others[260 - len(must_confirm):]
    pending = remaining[:40]
    unlinked = remaining[40:]
    assert len(confirmed) == 260 and len(pending) == 40 and len(unlinked) == 100

    # --- 60 planted cross-framework equivalents (same concept, different framework) ---
    equivalents: list[tuple[dict, dict]] = []
    seen_pairs: set[tuple[str, str]] = set()
    by_concept: dict[str, list[dict]] = {}
    for o in outcomes:
        by_concept.setdefault(o["concept_id"], []).append(o)
    for cid, group in sorted(by_concept.items()):
        cbse = [o for o in group if o["framework"] == "CBSE"]
        other = [o for o in group if o["framework"] != "CBSE"]
        for a in cbse[:1]:
            for b in other[:3]:
                key = (a["id"], b["id"])
                if key not in seen_pairs and len(equivalents) < 60:
                    seen_pairs.add(key)
                    equivalents.append((a, b))
    assert len(equivalents) == 60, len(equivalents)

    # --- SQL ---
    lines: list[str] = []
    w = lines.append
    w("-- 0006_setu.sql -- GENERATED by worker/scripts/gen_setu_seed.py. Do not hand-edit.")
    w("-- Synthetic curriculum spine for the fictional demo tenant (Section 9). 400 outcomes,")
    w("-- 120 concepts, 260 human-confirmed links, 40 pending, 60 planted cross-framework")
    w("-- equivalents, one Cambridge Lower Secondary -> CBSE Class 9 student with 7 planted gaps.")
    w("")
    w("insert into subjects (id, school_id, name, code) values")
    w(f"  ({q(SUBJECTS['SST'][0])}, {q(SCHOOL)}, 'Social Science', 'SST'),")
    w(f"  ({q(SUBJECTS['ENG'][0])}, {q(SCHOOL)}, 'English', 'ENG');")
    w("")
    w("insert into school_frameworks (school_id, framework_id, grades)")
    w(f"select {q(SCHOOL)}, id, case code when 'IB_MYP' then array['6','7','8','9','10'] when 'CAMB_PRIMARY' then array['1','2','3','4','5']")
    w("  when 'CAMB_LOWER_SEC' then array['6','7','8'] when 'IGCSE' then array['9','10'] else array['11','12'] end")
    w("from frameworks where code in ('IB_MYP','CAMB_PRIMARY','CAMB_LOWER_SEC','IGCSE','AP');")
    w("")
    w("-- additional sections so a teacher can hold a CBSE and an IGCSE Grade 9 at once (multi-board planning view)")
    w("insert into sections (id, school_id, grade, section, framework_id) select 'c0000000-0000-0000-0000-000000000003', " + q(SCHOOL) + ", '9', 'A', id from frameworks where code = 'CBSE';")
    w("insert into sections (id, school_id, grade, section, framework_id) select 'c0000000-0000-0000-0000-000000000004', " + q(SCHOOL) + ", '9', 'B', id from frameworks where code = 'IGCSE';")
    w("insert into teaching_assignments (school_id, teacher_id, section_id, subject_id, academic_year) values")
    w(f"  ({q(SCHOOL)}, {q(TEACHER)}, 'c0000000-0000-0000-0000-000000000003', {q(SUBJECTS['SCI'][0])}, {q(YEAR)}),")
    w(f"  ({q(SCHOOL)}, {q(TEACHER)}, 'c0000000-0000-0000-0000-000000000004', {q(SUBJECTS['SCI'][0])}, {q(YEAR)});")
    w("")
    w("insert into concepts (id, school_id, subject_id, title, stage, parent_id) values")
    rows = []
    for c in concepts:
        rows.append(f"  ({q(c['id'])}, {q(SCHOOL)}, {q(c['subject_id'])}, {q(c['title'])}, {q(c['stage']) if c['stage'] else 'null'}, {q(c['parent_id']) if c['parent_id'] else 'null'})")
    w(",\n".join(rows) + ";")
    w("")
    w("insert into learning_outcomes (id, school_id, framework_id, subject_id, grade, ref_code, statement, cognitive_level, source_document)")
    w("select v.id::uuid, " + q(SCHOOL) + ", f.id, v.subject_id::uuid, v.grade, v.ref_code, v.statement, v.cognitive_level, v.source_document")
    w("from (values")
    rows = []
    for o in outcomes:
        rows.append(f"  ({q(o['id'])}, {q(o['framework'])}, {q(o['subject_id'])}, {q(o['grade'])}, {q(o['ref_code'])}, {q(o['statement'])}, {q(o['cognitive_level'])}, {q('Synthetic ' + o['framework'] + ' framework document (demo)')})")
    w(",\n".join(rows))
    w(") as v(id, framework_code, subject_id, grade, ref_code, statement, cognitive_level, source_document)")
    w("join frameworks f on f.code = v.framework_code;")
    w("")
    w("insert into outcome_concepts (learning_outcome_id, concept_id, confidence, method, confirmed_by, confirmed_at) values")
    rows = [f"  ({q(o['id'])}, {q(o['concept_id'])}, 0.91, 'human_confirmed', {q(ACADEMIC)}, now() - interval '30 days')" for o in confirmed]
    rows += [f"  ({q(o['id'])}, {q(o['concept_id'])}, 0.84, 'embedding_suggested', null, null)" for o in pending]
    w(",\n".join(rows) + ";")
    w("")
    w("insert into cross_alignments (school_id, outcome_a, outcome_b, similarity, relation, confirmed_by, confirmed_at) values")
    rows = [f"  ({q(SCHOOL)}, {q(a['id'])}, {q(b['id'])}, 0.9, 'equivalent', {q(ACADEMIC)}, now() - interval '20 days')" for a, b in equivalents[:30]]
    w(",\n".join(rows) + ";")
    w("")
    # units: CBSE 6 Science, 3 units of 8 outcomes each? use CBSE grade 6 science outcomes
    cbse6sci = [o for o in outcomes if o["framework"] == "CBSE" and o["grade"] == "6" and o["subject"] == "SCI"]
    cbse9sci = [o for o in outcomes if o["framework"] == "CBSE" and o["grade"] == "9" and o["subject"] == "SCI"]
    igcse9sci = [o for o in outcomes if o["framework"] == "IGCSE" and o["grade"] == "9" and o["subject"] == "SCI"]
    units = [
        ("u-6-1", "Living things and their surroundings", "6", "CBSE", 1, cbse6sci[:4]),
        ("u-6-2", "Matter, materials and change", "6", "CBSE", 2, cbse6sci[4:8]),
        ("u-9-1", "Cells to organisms", "9", "CBSE", 1, cbse9sci[:4]),
        ("u-9-2", "Matter around us", "9", "CBSE", 2, cbse9sci[4:8]),
        ("u-9-igcse-1", "Characteristics of living organisms", "9", "IGCSE", 1, igcse9sci[:3]),
        ("u-9-igcse-2", "Organisation and maintenance", "9", "IGCSE", 2, igcse9sci[3:5]),
    ]
    w("insert into units (id, school_id, title, subject_id, grade, framework_id, planned_hours, sequence_no, academic_year, created_by)")
    w("select v.id::uuid, " + q(SCHOOL) + ", v.title, " + q(SUBJECTS['SCI'][0]) + ", v.grade, f.id, v.hours, v.seq, " + q(YEAR) + ", " + q(TEACHER))
    w("from (values")
    rows = [f"  ({q(uid('unit', k))}, {q(t)}, {q(g)}, {q(fw)}, {12 + 2 * s}, {s})" for k, t, g, fw, s, _ in units]
    w(",\n".join(rows) + ") as v(id, title, grade, framework_code, hours, seq) join frameworks f on f.code = v.framework_code;")
    w("insert into unit_outcomes (unit_id, learning_outcome_id) values")
    rows = [f"  ({q(uid('unit', k))}, {q(o['id'])})" for k, *_r, outs in units for o in outs]
    w(",\n".join(rows) + ";")
    w("")
    # coverage for section 6A: first unit taught, second partially
    w("insert into coverage (school_id, learning_outcome_id, section_id, academic_year, taught_on, assessed_count, last_assessed_on) values")
    rows = []
    for i, o in enumerate(cbse6sci[:6]):
        rows.append(f"  ({q(SCHOOL)}, {q(o['id'])}, 'c0000000-0000-0000-0000-000000000001', {q(YEAR)}, current_date - {40 - i * 5}, {2 if i < 4 else 0}, {('current_date - ' + str(10 + i)) if i < 4 else 'null'})")
    for i, o in enumerate(cbse9sci[:3]):
        rows.append(f"  ({q(SCHOOL)}, {q(o['id'])}, 'c0000000-0000-0000-0000-000000000003', {q(YEAR)}, current_date - {30 - i * 7}, 1, current_date - {5 + i})")
    w(",\n".join(rows) + ";")
    w("")
    w("-- one seeded student moving Cambridge Lower Secondary -> CBSE Class 9 (7 planted gaps)")
    w("update students set previous_framework_id = (select id from frameworks where code = 'CAMB_LOWER_SEC'),")
    w("  section_id = 'c0000000-0000-0000-0000-000000000003'")
    w("where school_id = " + q(SCHOOL) + " and admission_no = 'KAL-2026-0007';")
    w("")
    (ROOT / "supabase/seed/0006_setu.sql").write_text("\n".join(lines) + "\n")

    fx = ROOT / "worker/tests/fixtures"
    fx.mkdir(parents=True, exist_ok=True)
    with (fx / "outcomes_400.csv").open("w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["framework_code", "subject_code", "grade", "ref_code", "statement", "cognitive_level"])
        for o in outcomes:
            wr.writerow([o["framework"], o["subject"], o["grade"], o["ref_code"], o["statement"], o["cognitive_level"]])
    with (fx / "equivalents_60.csv").open("w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["outcome_a_ref", "outcome_a_framework", "outcome_b_ref", "outcome_b_framework", "concept_title"])
        for a, b in equivalents:
            wr.writerow([a["ref_code"], a["framework"], b["ref_code"], b["framework"], a["concept_name"]])
    with (fx / "concepts_120.csv").open("w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["subject_code", "title", "stage"])
        for c in concepts:
            if c["parent_id"] is not None:
                wr.writerow([next(k for k, v in SUBJECTS.items() if v[0] == c["subject_id"]), c["title"], c["stage"]])

    print(f"outcomes={len(outcomes)} concepts={len([c for c in concepts if c['parent_id']])} confirmed={len(confirmed)} pending={len(pending)} equivalents={len(equivalents)} gap_concepts={len(gap_concepts)}")


if __name__ == "__main__":
    main()
