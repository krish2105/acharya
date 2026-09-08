"""
Paper assembly as constraint satisfaction, not generation (Section 6.4 step 6).
Selects approved bank items that satisfy the blueprint's sections, marks,
competency percentage, Bloom mix and outcome coverage. When the bank cannot
satisfy a slot, reports exactly which slot is short.
"""

import hashlib
import random
from collections import Counter
from dataclasses import dataclass, field

from supabase import Client

from .pdf import render_pdf, upload_pdf

COMPETENCY_TYPES = {"case_based", "source_based", "competency_cluster"}
OBJECTIVE_TYPES = {"mcq", "assertion_reason"}
HIGHER_BLOOM = {"apply", "analyse", "evaluate", "create"}
BLOOMS = ["remember", "understand", "apply", "analyse", "evaluate", "create"]


def is_competency(item: dict) -> bool:
    return item["item_type"] in COMPETENCY_TYPES or item["cognitive_level"] in HIGHER_BLOOM


@dataclass
class Slot:
    label: str
    title: str
    item_types: list[str]
    marks_each: float
    count: int
    picked: list[dict] = field(default_factory=list)


class Solver:
    def __init__(self, pool: list[dict], composition: dict, total_marks: float, required_outcomes: set[str] | None, seed: int = 0):
        self.pool = pool
        self.comp = composition
        self.total = float(total_marks)
        self.required = required_outcomes or set()
        self.rng = random.Random(seed)
        self.slots = [Slot(s["label"], s.get("title", s["label"]), s["item_types"], float(s["marks_each"]), int(s["count"])) for s in composition["sections"]]
        self.target_comp = float(composition.get("competency_pct", 0)) / 100 * self.total
        self.bloom_mix = composition.get("bloom_mix", {})

    # ------------------------------------------------------------------ scoring
    def _state(self):
        chosen = [i for s in self.slots for i in s.picked]
        comp_marks = sum(float(i["marks"]) for i in chosen if is_competency(i))
        outcome_counts = Counter(o for i in chosen for o in i["outcome_ids"])
        bloom_marks = Counter()
        for i in chosen:
            bloom_marks[i["cognitive_level"]] += float(i["marks"])
        diff = Counter(i.get("difficulty_intended") or "medium" for i in chosen)
        return chosen, comp_marks, outcome_counts, bloom_marks, diff

    def _score(self, item: dict, comp_marks: float, outcome_counts: Counter, bloom_marks: Counter, diff: Counter, chosen_marks: float) -> float:
        s = 0.0
        m = float(item["marks"])
        if is_competency(item):
            s += 3.0 if comp_marks < self.target_comp else -1.5
        elif comp_marks >= self.target_comp:
            s += 1.0
        new = [o for o in item["outcome_ids"] if outcome_counts[o] == 0]
        s += 2.0 * len(new)
        s += 2.5 * len([o for o in new if o in self.required])
        s -= 1.5 * sum(1 for o in item["outcome_ids"] if outcome_counts[o] >= 2)
        if self.bloom_mix and chosen_marks > 0:
            target = float(self.bloom_mix.get(item["cognitive_level"], 0))
            current = bloom_marks[item["cognitive_level"]] / chosen_marks
            s += 1.0 if current < target else -0.5
        d = item.get("difficulty_intended") or "medium"
        n = sum(diff.values()) or 1
        s += 0.5 if {"easy": 0.3, "medium": 0.5, "hard": 0.2}[d] > diff[d] / n else 0.0
        s += (int(hashlib.sha1(f"{item['id']}{self.rng.random()}".encode()).hexdigest(), 16) % 100) / 1000.0
        return s

    # ------------------------------------------------------------------ solve
    def solve(self) -> tuple[list[tuple[dict, Slot, int]], list[dict]]:
        used: set[str] = set()
        shortfalls: list[dict] = []
        for slot in self.slots:
            cands = [i for i in self.pool if i["item_type"] in slot.item_types and float(i["marks"]) == slot.marks_each and i["id"] not in used]
            if len(cands) < slot.count:
                shortfalls.append({
                    "section": slot.label, "title": slot.title, "item_types": slot.item_types, "marks_each": slot.marks_each,
                    "needed": slot.count, "available": len(cands), "short_by": slot.count - len(cands),
                })
            for _ in range(min(slot.count, len(cands))):
                chosen, comp_marks, oc, bm, diff = self._state()
                chosen_marks = sum(float(i["marks"]) for i in chosen)
                best = max(cands, key=lambda i: self._score(i, comp_marks, oc, bm, diff, chosen_marks))
                cands.remove(best)
                slot.picked.append(best)
                used.add(best["id"])

        self._improve(used)

        chosen, comp_marks, oc, *_ = self._state()
        missing_required = [o for o in self.required if oc[o] == 0]
        if missing_required:
            shortfalls.append({"section": "*", "title": "Outcome coverage", "kind": "outcome_coverage", "outcome_ids": missing_required, "short_by": len(missing_required)})

        result = []
        for slot in self.slots:
            for n, item in enumerate(slot.picked, start=1):
                result.append((item, slot, n))
        return result, shortfalls

    def _improve(self, used: set[str], iterations: int = 600) -> None:
        """Targeted local search: when competency marks overshoot, swap a
        competency item for a lower-Bloom one of the same slot (and vice versa);
        always try to cover required outcomes. Accepts only strict improvements."""
        def objective() -> float:
            chosen, comp_marks, oc, *_ = self._state()
            missing = sum(1 for o in self.required if oc[o] == 0)
            return abs(comp_marks - self.target_comp) + 6.0 * missing
        best = objective()
        for _ in range(iterations):
            _, comp_marks, oc, *_ = self._state()
            over = comp_marks > self.target_comp
            missing = [o for o in self.required if oc[o] == 0]
            slot = self.rng.choice([s for s in self.slots if s.picked] or self.slots)
            if not slot.picked:
                continue
            # prefer to replace an item of the "wrong" kind for the current direction
            idxs = [i for i, it in enumerate(slot.picked) if is_competency(it) == over] or list(range(len(slot.picked)))
            idx = self.rng.choice(idxs)
            current = slot.picked[idx]
            cands = [i for i in self.pool if i["item_type"] in slot.item_types and float(i["marks"]) == slot.marks_each and i["id"] not in used]
            if not cands:
                continue
            if missing:
                covering = [i for i in cands if any(o in missing for o in i["outcome_ids"])]
                cands = covering or cands
            elif abs(comp_marks - self.target_comp) > 0.5:
                directional = [i for i in cands if is_competency(i) != over]
                cands = directional or cands
            cand = self.rng.choice(cands)
            slot.picked[idx] = cand
            used.discard(current["id"])
            used.add(cand["id"])
            val = objective()
            if val < best:
                best = val
            else:
                slot.picked[idx] = current
                used.discard(cand["id"])
                used.add(current["id"])
            if best == 0:
                break


def compliance_report(chosen: list[dict], composition: dict, total_marks: float, outcome_refs: dict[str, str]) -> dict:
    marks = sum(float(i["marks"]) for i in chosen)
    comp = sum(float(i["marks"]) for i in chosen if is_competency(i))
    obj = sum(float(i["marks"]) for i in chosen if i["item_type"] in OBJECTIVE_TYPES)
    long_ = sum(float(i["marks"]) for i in chosen if i["item_type"] == "long_answer")
    bloom = Counter()
    for i in chosen:
        bloom[i["cognitive_level"]] += float(i["marks"])
    diff = Counter(i.get("difficulty_intended") or "medium" for i in chosen)
    covered = sorted({outcome_refs.get(o, o) for i in chosen for o in i["outcome_ids"]})
    pct = lambda x: round((x / marks) * 100, 1) if marks else 0.0  # noqa: E731
    return {
        "items": len(chosen),
        "total_marks": marks, "target_marks": float(total_marks), "marks_ok": abs(marks - float(total_marks)) <= 2,
        "competency_pct": pct(comp), "competency_target": composition.get("competency_pct"),
        "competency_ok": abs(pct(comp) - float(composition.get("competency_pct", 0))) <= 3,
        "objective_pct": pct(obj), "objective_target": composition.get("objective_pct"),
        "long_answer_pct": pct(long_), "long_answer_target": composition.get("long_answer_pct"),
        "bloom": {b: pct(bloom[b]) for b in BLOOMS}, "bloom_target": {b: round(float(v) * 100, 1) for b, v in composition.get("bloom_mix", {}).items()},
        "difficulty": dict(diff),
        "outcomes_covered": covered,
    }


def _load_pool(db: Client, school_id: str, subject_id: str, grade: str, framework_id: str | None, exclude: set[str]) -> tuple[list[dict], dict[str, str]]:
    q = db.table("items").select("id, item_type, marks, cognitive_level, difficulty_intended, stem, stimulus, options, parts, answer_key, marking_scheme").eq("school_id", school_id).eq("status", "approved").eq("subject_id", subject_id).eq("grade", grade)
    if framework_id:
        q = q.eq("framework_id", framework_id)
    items = [i for i in q.execute().data if i["id"] not in exclude]
    ids = [i["id"] for i in items]
    links: dict[str, list[str]] = {}
    refs: dict[str, str] = {}
    if ids:
        for chunk in range(0, len(ids), 200):
            rows = db.table("item_outcomes").select("item_id, learning_outcome_id, learning_outcomes(ref_code)").in_("item_id", ids[chunk:chunk + 200]).execute().data
            for r in rows:
                links.setdefault(r["item_id"], []).append(r["learning_outcome_id"])
                if r.get("learning_outcomes"):
                    refs[r["learning_outcome_id"]] = r["learning_outcomes"]["ref_code"]
    for i in items:
        i["outcome_ids"] = links.get(i["id"], [])
    return items, refs


def assemble_paper(db: Client, school_id: str, *, blueprint_id: str, section_id: str | None, title: str, exam_kind: str,
                   actor_id: str | None, scheduled_on: str | None = None, exclude_item_ids: set[str] | None = None,
                   required_outcome_ids: set[str] | None = None, paired_with: str | None = None, seed: int = 0) -> dict:
    bp = db.table("blueprints").select("*").eq("id", blueprint_id).eq("school_id", school_id).single().execute().data
    pool, refs = _load_pool(db, school_id, bp["subject_id"], bp["grade"], bp.get("framework_id"), exclude_item_ids or set())
    solver = Solver(pool, bp["composition"], bp["total_marks"], required_outcome_ids, seed)
    chosen, shortfalls = solver.solve()
    compliance = compliance_report([c for c, *_ in chosen], bp["composition"], bp["total_marks"], refs)

    paper = db.table("papers").insert({
        "school_id": school_id, "blueprint_id": blueprint_id, "section_id": section_id, "title": title, "exam_kind": exam_kind,
        "scheduled_on": scheduled_on, "status": "draft", "compliance": compliance, "shortfalls": shortfalls,
        "paired_with": paired_with, "created_by": actor_id,
    }).execute().data[0]
    if chosen:
        db.table("paper_items").insert([
            {"paper_id": paper["id"], "item_id": item["id"], "section_label": slot.label, "q_no": f"{slot.label}{n}", "marks": item["marks"]}
            for item, slot, n in chosen
        ]).execute()
    return {"paper_id": paper["id"], "compliance": compliance, "shortfalls": shortfalls, "item_count": len(chosen)}


def create_improvement_paper(db: Client, school_id: str, main_paper_id: str, actor_id: str | None, scheduled_on: str | None = None) -> dict:
    main = db.table("papers").select("id, blueprint_id, section_id, title").eq("id", main_paper_id).eq("school_id", school_id).single().execute().data
    main_items = [r["item_id"] for r in db.table("paper_items").select("item_id").eq("paper_id", main_paper_id).execute().data]
    outcome_ids = {r["learning_outcome_id"] for r in db.table("item_outcomes").select("learning_outcome_id").in_("item_id", main_items).execute().data}
    return assemble_paper(
        db, school_id, blueprint_id=main["blueprint_id"], section_id=main["section_id"],
        title=f"{main['title']} — Improvement", exam_kind="improvement_practice", actor_id=actor_id, scheduled_on=scheduled_on,
        exclude_item_ids=set(main_items), required_outcome_ids=outcome_ids, paired_with=main_paper_id, seed=7,
    )


def render_paper_pdfs(db: Client, school_id: str, paper_id: str) -> dict:
    paper = db.table("papers").select("*, blueprints(label, total_marks, duration_minutes, composition, frameworks(code, name), subjects(name)), sections(grade, section)").eq("id", paper_id).eq("school_id", school_id).single().execute().data
    rows = db.table("paper_items").select("section_label, q_no, marks, items(*)").eq("paper_id", paper_id).order("q_no").execute().data
    item_ids = [r["items"]["id"] for r in rows]
    links = db.table("item_outcomes").select("item_id, learning_outcomes(ref_code, frameworks(code))").in_("item_id", item_ids).execute().data if item_ids else []
    outcomes_by_item: dict[str, list[str]] = {}
    for l in links:
        lo = l["learning_outcomes"]
        outcomes_by_item.setdefault(l["item_id"], []).append(f"{lo['frameworks']['code']} / {lo['ref_code']}")
    school = db.table("schools").select("name").eq("id", school_id).single().execute().data

    def sort_key(r):
        lbl, num = r["q_no"][:1], r["q_no"][1:]
        return (r["section_label"] or "", int(num) if num.isdigit() else 0)

    rows.sort(key=sort_key)
    sections: dict[str, list[dict]] = {}
    for r in rows:
        it = r["items"]
        it["q_no"] = r["q_no"]
        it["q_marks"] = r["marks"]
        it["outcomes"] = outcomes_by_item.get(it["id"], [])
        sections.setdefault(r["section_label"] or "A", []).append(it)
    titles = {s["label"]: s.get("title", s["label"]) for s in paper["blueprints"]["composition"]["sections"]}

    files = {}
    for mode in ("question", "key", "scheme", "compliance"):
        pdf = render_pdf("paper.html", {
            "mode": mode, "title": paper["title"], "school_name": school["name"], "paper": paper, "sections": sections,
            "section_titles": titles, "compliance": paper.get("compliance") or {}, "shortfalls": paper.get("shortfalls") or [],
            "blueprint": paper["blueprints"], "section_info": paper.get("sections"),
        })
        files[mode] = upload_pdf(db, "papers", school_id, f"{paper_id}/{mode}.pdf", pdf)
    db.table("papers").update({"files": files}).eq("id", paper_id).execute()
    return files


def import_marks(db: Client, school_id: str, paper_id: str, data: bytes) -> dict:
    """CSV: admission_no, q_no, marks_obtained. Upserts responses for the paper."""
    import csv
    import io

    q_map = {r["q_no"]: (r["item_id"], float(r["marks"])) for r in db.table("paper_items").select("q_no, item_id, marks").eq("paper_id", paper_id).execute().data}
    students = {s["admission_no"]: s["id"] for s in db.table("students").select("id, admission_no").eq("school_id", school_id).execute().data}
    rows, skipped = [], 0
    for rec in csv.DictReader(io.StringIO(data.decode("utf-8-sig"))):
        sid = students.get((rec.get("admission_no") or "").strip())
        q = q_map.get((rec.get("q_no") or "").strip())
        if not sid or not q:
            skipped += 1
            continue
        rows.append({"school_id": school_id, "paper_id": paper_id, "item_id": q[0], "student_id": sid,
                     "marks_obtained": float(rec.get("marks_obtained") or 0), "max_marks": q[1]})
    for i in range(0, len(rows), 500):
        db.table("responses").upsert(rows[i:i + 500], on_conflict="paper_id,item_id,student_id").execute()
    return {"imported": len(rows), "skipped": skipped}
