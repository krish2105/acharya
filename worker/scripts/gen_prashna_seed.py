"""
Deterministic synthetic PRASHNA seed (Section 9): 620 items (410 approved, 90
pending HOD review, 120 teacher drafts) across all 8 types, 4 blueprints, 12
papers including one main/improvement pair, response data for 6 papers with
4 planted mislabelled-difficulty items. Writes supabase/seed/0009_prashna.sql.

Depends on the SETU seed's outcome ids (uuid5 of framework + ref_code).
"""

import json
import random
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCHOOL = "a0000000-0000-0000-0000-000000000001"
TEACHER = "d0000000-0000-0000-0000-000000000001"
HOD = "d0000000-0000-0000-0000-000000000003"
SUBJ = {"SCI": "b0000000-0000-0000-0000-000000000001", "MATH": "b0000000-0000-0000-0000-000000000002",
        "SST": "b0000000-0000-0000-0000-000000000004", "ENG": "b0000000-0000-0000-0000-000000000005"}
SECTION_10A = "c0000000-0000-0000-0000-000000000005"
rng = random.Random(2026)


def uid(*parts: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "acharya/prashna/" + "/".join(parts)))


def outcome_id(fw: str, ref: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "acharya/setu/" + "/".join(["outcome", fw, ref])))


def q(s) -> str:
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def jq(obj) -> str:
    return q(json.dumps(obj)) + "::jsonb"


MARKS = {"mcq": 1, "assertion_reason": 1, "short_answer": 2, "numerical": 2, "diagram": 3, "long_answer": 5,
         "case_based": 4, "source_based": 4, "competency_cluster": 4}
BLOOM = ["remember", "understand", "apply", "analyse", "evaluate", "create"]
TOPIC_WORDS = {
    "SCI": ["photosynthesis", "cell division", "the reactivity series", "Ohm's law", "refraction", "acids and bases", "food chains", "heredity", "enzymes", "sound waves"],
    "MATH": ["linear equations", "quadratic equations", "similar triangles", "probability", "arithmetic progressions", "circles", "surface areas", "trigonometric ratios", "statistics", "coordinate geometry"],
    "SST": ["the monsoon", "federalism", "the freedom movement", "resources", "democracy", "agriculture", "urbanisation", "the Constitution", "trade routes", "conservation"],
    "ENG": ["the poem's imagery", "the narrator's tone", "a formal letter", "the author's purpose", "a persuasive argument", "the passage's theme", "dialogue", "a report", "a summary", "vocabulary in context"],
}


def make_item(subject: str, fw: str, grade: str, ref: str, statement: str, itype: str, k: int, status: str) -> dict:
    topic = TOPIC_WORDS[subject][k % 10]
    bloom = BLOOM[(k * 7 + len(ref)) % 6] if itype not in ("mcq", "assertion_reason") else BLOOM[(k % 4) + 1]
    if itype in ("case_based", "source_based", "competency_cluster"):
        bloom = BLOOM[2 + (k % 3)]
    marks = MARKS[itype]
    if itype in ("short_answer", "numerical") and k % 2:
        marks = 3
    diff = ["easy", "medium", "hard"][(k + len(topic)) % 3]
    stem, stimulus, options, parts, key = "", None, None, None, {}
    if itype == "mcq":
        stem = f"A student investigates {topic}. Which statement best explains the observation described in the outcome '{statement.rstrip('.')}'?"
        options = [{"label": l, "text": f"Option {l}: {topic} explanation {i + 1}"} for i, l in enumerate("ABCD")]
        key = {"correct": "ABCD"[k % 4]}
    elif itype == "assertion_reason":
        stem = f"Assertion (A): {topic.capitalize()} follows the principle described in {ref}. Reason (R): The underlying mechanism explains the assertion."
        options = [{"label": "A", "text": "Both A and R are true and R explains A"}, {"label": "B", "text": "Both A and R are true but R does not explain A"},
                   {"label": "C", "text": "A is true but R is false"}, {"label": "D", "text": "A is false but R is true"}]
        key = {"correct": "ABCD"[k % 4]}
    elif itype in ("case_based", "source_based", "competency_cluster"):
        stimulus = f"A Grade {grade} group recorded observations about {topic} over three weeks, noting changes under two conditions and tabulating the results before drawing a conclusion. (Original synthetic scenario #{k}.)"
        stem = f"(i) Identify the variable being tested. (ii) Apply {topic} to explain the result. (iii) Evaluate whether the conclusion is justified."
        parts = [{"text": "Identify", "marks": 1}, {"text": "Apply", "marks": 1}, {"text": "Evaluate", "marks": 2}]
        key = {"parts": [{"answer": f"Variable relates to {topic}", "marks": 1}, {"answer": "Applies the principle correctly", "marks": 1}, {"answer": "Judges validity with evidence", "marks": 2}]}
    elif itype == "numerical":
        stem = f"Using the data on {topic} given (values: 12.5, 3.2 and 0.8 in SI units), calculate the required quantity and state its unit."
        key = {"answer": f"{round(12.5 * 3.2 / 0.8, 1)} units", "working": "Substitute, simplify, state unit"}
    elif itype == "diagram":
        stem = f"Draw a labelled diagram illustrating {topic} and mark three essential features."
        key = {"answer": "Correct diagram with three labels", "points": ["label 1", "label 2", "label 3"]}
    elif itype == "long_answer":
        stem = f"(a) Explain {topic} with reference to {ref}. (b) Discuss two applications or implications with justification."
        key = {"answer": f"Model answer on {topic}", "points": ["definition", "mechanism", "application 1", "application 2", "justification"]}
    else:  # short_answer
        stem = f"Explain briefly how {topic} relates to the outcome '{statement.rstrip('.')}'."
        key = {"answer": f"Brief explanation of {topic}", "points": ["point 1", "point 2"] + (["point 3"] if marks == 3 else [])}
    return {
        "id": uid("item", fw, ref, itype, str(k)), "subject_id": SUBJ[subject], "fw": fw, "grade": grade, "item_type": itype,
        "stem": stem, "stimulus": stimulus, "options": options, "parts": parts, "answer_key": key,
        "marking_scheme": f"{marks} mark(s): award per point in the key; partial credit for method.", "marks": marks,
        "cognitive_level": bloom, "difficulty_intended": diff, "status": status, "outcome_ids": [outcome_id(fw, ref)],
        "ref": ref,
    }


# --- plan: (framework, subject, grade, ref template, ref numbers, per-outcome type multiset, statuses) ---
CBSE10_TYPES = (["mcq"] * 4 + ["assertion_reason"] * 2 + ["short_answer"] * 4 + ["numerical"] * 2 + ["diagram"] +
                ["long_answer"] * 2 + ["case_based"] * 2 + ["source_based"] + ["competency_cluster"])  # 19 per outcome
OTHER_TYPES = ["mcq", "mcq", "assertion_reason", "short_answer", "numerical", "long_answer", "case_based", "diagram", "source_based", "competency_cluster"]


def refs(prefix: str, count: int, per_unit: int = 3, style: str = "cbse") -> list[str]:
    out = []
    for n in range(1, count + 1):
        if style == "cbse":
            out.append(f"{prefix}.{(n - 1) // per_unit + 1}.{n}")
        elif style == "myp":
            out.append(f"{prefix}.{'ABCD'[(n - 1) % 4]}.{n}")
        elif style == "igcse":
            out.append(f"{prefix}.{n}")
        elif style == "ap":
            out.append(f"{prefix}.{(n - 1) // 3 + 1}.{n}")
    return out


def main() -> None:
    items: list[dict] = []
    # CBSE 10 Science: 8 outcomes x 19 = 152 approved (pool for main/improvement pair)
    for ref in refs("CBSE.SCI.10", 8):
        for k, t in enumerate(CBSE10_TYPES):
            items.append(make_item("SCI", "CBSE", "10", ref, f"outcome {ref}", t, k, "approved"))
    plan = [
        ("CBSE", "SCI", "9", refs("CBSE.SCI.9", 8), 60),
        ("CBSE", "MATH", "10", refs("CBSE.MATH.10", 8), 60),
        ("CBSE", "MATH", "9", refs("CBSE.MATH.9", 8), 30),
        ("CBSE", "SST", "10", refs("CBSE.SST.10", 8), 24),
        ("CBSE", "ENG", "10", refs("CBSE.ENG.10", 8), 24),
        ("IGCSE", "SCI", "9", refs("IGCSE.0610.9", 5, style="igcse"), 30),
        ("IGCSE", "SCI", "10", refs("IGCSE.0610.10", 5, style="igcse"), 30),
        ("IB_MYP", "SCI", "9", refs("MYP.SCI.9", 3, style="myp"), 15),
        ("IB_MYP", "MATH", "9", refs("MYP.MATH.9", 3, style="myp"), 15),
        ("AP", "SCI", "11", refs("AP.BIO.11", 9, style="ap"), 30),
        ("IB_DP", "SCI", "11", refs("DP.BIO.11", 4), 20),
        ("CBSE", "SCI", "8", refs("CBSE.SCI.8", 8), 40),
        ("CBSE", "MATH", "8", refs("CBSE.MATH.8", 8), 40),
        ("CBSE", "SCI", "7", refs("CBSE.SCI.7", 8), 30),
        ("CBSE", "MATH", "6", refs("CBSE.MATH.6", 8), 20),
    ]
    for fw, subj, grade, rlist, n in plan:
        for i in range(n):
            ref = rlist[i % len(rlist)]
            t = OTHER_TYPES[i % len(OTHER_TYPES)]
            items.append(make_item(subj, fw, grade, ref, f"outcome {ref}", t, i, "approved"))
    assert len(items) == 620, len(items)
    # statuses: last 210 become pending (90) and draft (120)
    for it in items[-210:-120]:
        it["status"] = "pending_review"
    for it in items[-120:]:
        it["status"] = "draft"
    approved = [i for i in items if i["status"] == "approved"]
    assert len(approved) == 410

    # --- blueprints ---
    fw_key = {"CBSE": "CBSE", "IGCSE": "IGCSE", "IB_MYP": "IB_MYP", "AP": "AP"}
    blueprints = [
        ("bp-cbse-2026", "CBSE", "SCI", "10", "CBSE Class 10 Science, Board Pattern 2026", 80, 180, {
            "competency_pct": 50, "objective_pct": 20, "long_answer_pct": 30,
            "bloom_mix": {"remember": 0.10, "understand": 0.20, "apply": 0.30, "analyse": 0.25, "evaluate": 0.10, "create": 0.05},
            "sections": [
                {"label": "A", "title": "Objective", "item_types": ["mcq", "assertion_reason"], "marks_each": 1, "count": 16},
                {"label": "B", "title": "Very short answer", "item_types": ["short_answer", "numerical"], "marks_each": 2, "count": 6},
                {"label": "C", "title": "Short answer", "item_types": ["short_answer", "numerical", "diagram"], "marks_each": 3, "count": 5},
                {"label": "D", "title": "Long answer", "item_types": ["long_answer"], "marks_each": 5, "count": 5},
                {"label": "E", "title": "Case / source based", "item_types": ["case_based", "source_based", "competency_cluster"], "marks_each": 4, "count": 3},
            ]}),
        ("bp-igcse", "IGCSE", "SCI", "10", "Cambridge IGCSE Biology 0610, Paper 4 pattern", 80, 75, {
            "competency_pct": 45, "objective_pct": 0, "long_answer_pct": 40,
            "bloom_mix": {"remember": 0.15, "understand": 0.25, "apply": 0.30, "analyse": 0.20, "evaluate": 0.10, "create": 0.0},
            "sections": [
                {"label": "A", "title": "Structured", "item_types": ["short_answer", "numerical", "diagram"], "marks_each": 3, "count": 10},
                {"label": "B", "title": "Data response", "item_types": ["source_based", "case_based"], "marks_each": 4, "count": 5},
                {"label": "C", "title": "Extended", "item_types": ["long_answer"], "marks_each": 5, "count": 6},
            ]}),
        ("bp-myp", "IB_MYP", "SCI", "9", "IB MYP Sciences, Criterion A-D summative", 40, 90, {
            "competency_pct": 60, "objective_pct": 10, "long_answer_pct": 25,
            "bloom_mix": {"remember": 0.05, "understand": 0.20, "apply": 0.30, "analyse": 0.25, "evaluate": 0.15, "create": 0.05},
            "sections": [
                {"label": "A", "title": "Knowing and understanding", "item_types": ["mcq", "short_answer"], "marks_each": 1, "count": 4},
                {"label": "B", "title": "Inquiring and designing", "item_types": ["case_based", "competency_cluster"], "marks_each": 4, "count": 4},
                {"label": "C", "title": "Processing and evaluating", "item_types": ["source_based", "numerical"], "marks_each": 4, "count": 3},
                {"label": "D", "title": "Reflecting on impacts", "item_types": ["long_answer"], "marks_each": 5, "count": 1},
                {"label": "E", "title": "Diagram", "item_types": ["diagram"], "marks_each": 3, "count": 1},
            ]}),
        ("bp-ap", "AP", "SCI", "11", "AP Biology, practice exam pattern", 60, 120, {
            "competency_pct": 55, "objective_pct": 40, "long_answer_pct": 20,
            "bloom_mix": {"remember": 0.10, "understand": 0.20, "apply": 0.30, "analyse": 0.30, "evaluate": 0.10, "create": 0.0},
            "sections": [
                {"label": "I", "title": "Multiple choice", "item_types": ["mcq"], "marks_each": 1, "count": 24},
                {"label": "II", "title": "Free response (short)", "item_types": ["short_answer", "numerical", "diagram"], "marks_each": 3, "count": 4},
                {"label": "III", "title": "Free response (long)", "item_types": ["long_answer", "case_based"], "marks_each": 4, "count": 6},
            ]}),
    ]

    # --- papers: 12, incl. one main/improvement pair, built from the CBSE-10 Science approved pool ---
    pool = [i for i in approved if i["fw"] == "CBSE" and i["grade"] == "10" and i["subject_id"] == SUBJ["SCI"]]
    by_type_marks: dict[tuple[str, int], list[dict]] = {}
    for it in pool:
        by_type_marks.setdefault((it["item_type"], it["marks"]), []).append(it)
    cbse_bp = blueprints[0][7]

    def assemble(exclude: set[str]) -> list[tuple[dict, str, str]]:
        chosen = []
        for sec in cbse_bp["sections"]:
            cands = [it for t in sec["item_types"] for it in by_type_marks.get((t, sec["marks_each"]), []) if it["id"] not in exclude]
            by_ref: dict[str, list[dict]] = {}
            for it in sorted(cands, key=lambda x: x["id"]):
                by_ref.setdefault(it["ref"], []).append(it)
            picked: list[dict] = []
            while len(picked) < sec["count"] and any(by_ref.values()):
                for ref in sorted(by_ref):          # round-robin across outcomes
                    if by_ref[ref] and len(picked) < sec["count"]:
                        picked.append(by_ref[ref].pop(0))
            for n, it in enumerate(picked, start=1):
                chosen.append((it, sec["label"], f"{sec['label']}{n}"))
                exclude.add(it["id"])
        return chosen

    used: set[str] = set()
    main_items = assemble(used)
    improvement_items = assemble(used)
    assert not ({i["id"] for i, *_ in main_items} & {i["id"] for i, *_ in improvement_items})

    papers = []
    papers.append(("paper-main", "CBSE Class 10 Science — Main Board Practice", "main_board_practice", "2027-02-15", "approved", main_items, None))
    papers.append(("paper-improvement", "CBSE Class 10 Science — Improvement Practice", "improvement_practice", "2027-05-10", "approved", improvement_items, "paper-main"))
    # six unit tests (with responses) of ~10 items each from the pool, plus four more papers
    ut_pool = sorted(pool, key=lambda x: x["id"])
    for n in range(6):
        sub = ut_pool[n * 10:(n + 1) * 10]
        papers.append((f"paper-ut-{n + 1}", f"Unit Test {n + 1} — Science 10A", "unit_test", f"2026-{7 + n:02d}-20", "approved",
                       [(it, "A", f"Q{i + 1}") for i, it in enumerate(sub)], None))
    for n in range(4):
        sub = ut_pool[60 + n * 8: 68 + n * 8]
        papers.append((f"paper-extra-{n + 1}", f"{['Midterm', 'Preboard 1', 'Preboard 2', 'Mock'][n]} — Science 10A", ["midterm", "preboard", "preboard", "mock"][n],
                       f"2026-1{n % 2}-05", "draft" if n == 3 else "approved", [(it, "A", f"Q{i + 1}") for i, it in enumerate(sub)], None))
    assert len(papers) == 12

    # --- responses for the 6 unit tests, 40 students in 10A, with 4 planted mislabelled items ---
    planted = [ut_pool[3], ut_pool[14], ut_pool[27], ut_pool[41]]  # appear in UT1, UT2, UT3, UT5
    planted_ids = {p["id"] for p in planted}
    # make planted items' labels contradict their observed behaviour
    for p in planted:
        p["difficulty_intended"] = "easy"
    students = [uid("student10a", str(i)) for i in range(1, 41)]
    responses = []
    for key, _t, kind, _d, _s, plist, _pair in papers:
        if kind != "unit_test":
            continue
        for si, sid in enumerate(students):
            ability = 0.35 + 0.6 * (si / 39)  # spread from weak to strong
            for it, _l, _qn in plist:
                if it["id"] in planted_ids:
                    p_full = ability * 0.3          # behaves hard although labelled easy
                else:
                    # keep every non-planted item inside its labelled facility band
                    base = {"easy": 0.86, "medium": 0.55, "hard": 0.25}[it["difficulty_intended"]]
                    p_full = min(0.98, base * (0.72 + ability * 0.5))
                r = rng.random()
                if r < p_full:
                    got = it["marks"]
                elif r < p_full + 0.25:
                    got = round(it["marks"] * 0.5, 1)
                else:
                    got = 0
                responses.append((key, it["id"], sid, got, it["marks"]))

    # Relabel non-planted items to the band their simulated responses actually land in,
    # so the only intended/observed contradictions are the four planted ones.
    fac: dict[str, list[float]] = {}
    for _pk, iid, _sid, got, mx in responses:
        fac.setdefault(iid, []).append(1.0 if got >= mx else 0.0)
    by_iid = {i["id"]: i for i in items}
    for iid, vals in fac.items():
        if iid in planted_ids:
            continue
        f = sum(vals) / len(vals)
        by_iid[iid]["difficulty_intended"] = "easy" if f >= 0.7 else ("medium" if f >= 0.4 else "hard")

    # --- SQL ---
    L: list[str] = []
    w = L.append
    w("-- 0009_prashna.sql -- GENERATED by worker/scripts/gen_prashna_seed.py. Do not hand-edit.")
    w("-- 620 synthetic items (410 approved / 90 pending / 120 drafts), 4 blueprints, 12 papers")
    w("-- (one main/improvement pair), responses for 6 unit tests with 4 planted mislabelled items.")
    w("")
    w("-- Grade 10 CBSE section + 40 synthetic students for response data")
    w(f"insert into sections (id, school_id, grade, section, framework_id) select {q(SECTION_10A)}, {q(SCHOOL)}, '10', 'A', id from frameworks where code = 'CBSE';")
    w(f"insert into teaching_assignments (school_id, teacher_id, section_id, subject_id, academic_year) values ({q(SCHOOL)}, {q(TEACHER)}, {q(SECTION_10A)}, {q(SUBJ['SCI'])}, '2026-27');")
    first = ["Aarav", "Diya", "Kabir", "Myra", "Vihaan", "Anika", "Reyansh", "Saanvi", "Arjun", "Ira", "Vivaan", "Kiara", "Ishaan", "Pari", "Ayaan", "Riya", "Advait", "Navya", "Rudra", "Tara"]
    last = ["Sharma", "Verma", "Iyer", "Nair", "Reddy", "Gupta", "Menon", "Rao", "Kulkarni", "Bose"]
    w("insert into students (id, school_id, admission_no, full_name, dob, section_id) values")
    w(",\n".join(f"  ({q(sid)}, {q(SCHOOL)}, 'KAL-2026-{100 + i:04d}', {q(first[i % 20] + ' ' + last[(i * 3) % 10])}, date '2010-04-01' + {i * 9}, {q(SECTION_10A)})" for i, sid in enumerate(students)) + ";")
    w("")
    w("-- items + outcome links + version 1 (via create_item, so the outcome-link trigger is exercised)")
    w("do $$ declare v uuid; begin")
    for it in items:
        payload = {k: it[k] for k in ("subject_id", "grade", "item_type", "stem", "stimulus", "options", "parts", "answer_key", "marking_scheme", "marks", "cognitive_level", "difficulty_intended")}
        payload.update({"id": it["id"], "school_id": SCHOOL, "framework_id": None, "origin": "ai_generated" if it["status"] != "draft" else "teacher_written", "status": "draft", "created_by": TEACHER})
        w(f"  v := create_item(jsonb_set({jq(payload)}, '{{framework_id}}', to_jsonb((select id::text from frameworks where code = {q(it['fw'])}))), array[{q(it['outcome_ids'][0])}::uuid]);")
    w("end $$;")
    w("")
    w("-- approvals ledger rows for approved items, then the status transitions the gate now permits")
    w("insert into approvals (school_id, artifact_type, artifact_id, generated_version, final_version, edit_distance, approved_by, approved_at)")
    w("select i.school_id, 'item', i.id, iv.body, iv.body, 0, " + q(HOD) + ", now() - (random() * interval '60 days')")
    w("from items i join item_versions iv on iv.item_id = i.id and iv.version = 1 where i.id in (")
    w(",\n".join(f"  {q(i['id'])}" for i in approved) + ");")
    w("update items set status = 'approved', approved_by = " + q(HOD) + ", approved_at = now() - interval '30 days' where id in (select artifact_id from approvals where artifact_type = 'item');")
    w("update items set status = 'pending_review' where id in (" + ",".join(q(i["id"]) for i in items if i["status"] == "pending_review") + ");")
    w("update items set origin = 'teacher_written' where status = 'draft';")
    w("")
    w("insert into blueprints (id, school_id, framework_id, subject_id, grade, label, total_marks, duration_minutes, composition)")
    w("select v.id::uuid, " + q(SCHOOL) + ", f.id, v.subject_id::uuid, v.grade, v.label, v.total, v.dur, v.comp::jsonb from (values")
    w(",\n".join(f"  ({q(uid('bp', k))}, {q(fw_key[fw])}, {q(SUBJ[subj])}, {q(g)}, {q(label)}, {total}, {dur}, {q(json.dumps(comp))})" for k, fw, subj, g, label, total, dur, comp in blueprints))
    w(") as v(id, fw, subject_id, grade, label, total, dur, comp) join frameworks f on f.code = v.fw;")
    w("")
    for key, title, kind, date, status, plist, pair in papers:
        bp = uid("bp", "bp-cbse-2026")
        w(f"insert into papers (id, school_id, blueprint_id, section_id, title, exam_kind, scheduled_on, status, created_by, paired_with) values ({q(uid('paper', key))}, {q(SCHOOL)}, {q(bp)}, {q(SECTION_10A)}, {q(title)}, {q(kind)}, {q(date)}, 'draft', {q(TEACHER)}, {q(uid('paper', pair)) if pair else 'null'});")
        w("insert into paper_items (paper_id, item_id, section_label, q_no, marks) values")
        w(",\n".join(f"  ({q(uid('paper', key))}, {q(it['id'])}, {q(lbl)}, {q(qn)}, {it['marks']})" for it, lbl, qn in plist) + ";")
        if status == "approved":
            w(f"insert into approvals (school_id, artifact_type, artifact_id, generated_version, final_version, edit_distance, approved_by) values ({q(SCHOOL)}, 'paper', {q(uid('paper', key))}, '{{}}', '{{}}', 0, {q(HOD)});")
            w(f"update papers set status = 'approved', approved_by = {q(HOD)}, approved_at = now() where id = {q(uid('paper', key))};")
    w("")
    w("-- planted mislabelled items: labelled easy, behave hard in the response data")
    w("update items set difficulty_intended = 'easy' where id in (" + ",".join(q(p["id"]) for p in planted) + ");")
    w("insert into responses (school_id, paper_id, item_id, student_id, marks_obtained, max_marks) values")
    w(",\n".join(f"  ({q(SCHOOL)}, {q(uid('paper', pk))}, {q(iid)}, {q(sid)}, {got}, {mx})" for pk, iid, sid, got, mx in responses) + ";")
    w("")
    w("select run_item_calibration(" + q(SCHOOL) + ");")
    (ROOT / "supabase/seed/0009_prashna.sql").write_text("\n".join(L) + "\n")
    (ROOT / "worker/tests/fixtures/planted_mislabelled.json").write_text(json.dumps([p["id"] for p in planted]))
    print(f"items={len(items)} approved={len(approved)} papers={len(papers)} responses={len(responses)} planted={len(planted)} main={len(main_items)} improvement={len(improvement_items)}")


if __name__ == "__main__":
    main()
