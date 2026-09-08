"""
SAARTHI generators (Section 6.5): all outcome-linked, all approval-gated,
always starting from a unit or outcome. Parent messages go through the
redaction round-trip (names out before the prompt, back in after) and a
post-validation that rejects comparative, diagnostic or predictive language.
"""

import re
from collections.abc import Callable, Iterator

from supabase import Client

from .config import Settings
from .gateway import GenerationResult, generate
from .pdf import render_pdf, upload_pdf

KINDS = ("lesson_plan", "worksheet", "rubric", "parent_message", "activity", "remediation_set", "revision_sheet")
LANGUAGE_NAMES = {"en": "English", "hi": "Hindi (Devanagari script) -- keep every JSON key exactly as specified in English; write only the values in Hindi"}

# Post-validation for parent-facing text (Phase 3 task 6, Phase 4 acceptance):
# comparative, diagnostic and predictive language is rejected outright.
PROHIBITED = [
    r"\bbetter than\b", r"\bworse than\b", r"\bcompared (?:to|with) (?:the )?(?:other|rest|class)", r"\brest of the class\b",
    r"\bone of the (?:weakest|best|worst|strongest)\b", r"\btop of the class\b", r"\bbottom of the class\b", r"\bbehind (?:the )?others\b",
    r"\brank(?:ed|ing)?\b", r"\bpercentile\b", r"\bclass average\b",
    r"\bdyslexi", r"\badhd\b", r"\badd\b", r"\bautis", r"\bdisorder\b", r"\bdiagnos", r"\bsyndrome\b", r"\bclinical\b",
    r"\blazy\b", r"\bslow learner\b", r"\blearning disab", r"\bspecial needs\b", r"\bdeficit\b",
    r"\bwill (?:fail|struggle|never)\b", r"\bat risk\b", r"\bpredict", r"\bunlikely to\b", r"\bdestined\b",
    # Hindi equivalents
    r"से बेहतर", r"से कमज़ोर", r"से कमजोर", r"बाकी कक्षा", r"रैंक", r"निदान", r"बीमारी", r"असफल हो",
]


def post_validate(text: str) -> list[str]:
    lowered = text.lower()
    return [p for p in PROHIBITED if re.search(p, lowered)]


class GuardrailError(Exception):
    def __init__(self, violations: list[str]):
        self.violations = violations
        super().__init__(f"output contains prohibited language: {violations}")


def _outcomes_for(db: Client, school_id: str, outcome_ids: list[str] | None, unit_id: str | None) -> list[dict]:
    if unit_id and not outcome_ids:
        outcome_ids = [r["learning_outcome_id"] for r in db.table("unit_outcomes").select("learning_outcome_id").eq("unit_id", unit_id).execute().data]
    if not outcome_ids:
        raise ValueError("generation must start from a unit or at least one learning outcome")
    rows = db.table("learning_outcomes").select("id, ref_code, statement, subject_id, grade, framework_id, frameworks(code, name), subjects(name)").in_("id", outcome_ids).eq("school_id", school_id).execute().data
    if not rows:
        raise ValueError("outcomes not found")
    return rows


def generate_artifact(
    db: Client, school_id: str, actor_id: str | None, kind: str, *, outcome_ids: list[str] | None = None, unit_id: str | None = None,
    section_id: str | None = None, student_id: str | None = None, language: str = "en", notes: str = "", periods: int = 3,
    period_minutes: int = 40, settings: Settings | None = None, on_stage: Callable[[str], None] | None = None,
) -> dict:
    if kind not in KINDS:
        raise ValueError(f"unknown artifact kind {kind}")
    if kind == "parent_message" and not student_id:
        raise ValueError("a parent message needs a student")
    stage = on_stage or (lambda _s: None)

    stage("resolving_outcomes")
    outcomes = _outcomes_for(db, school_id, outcome_ids, unit_id)
    first = outcomes[0]
    unit_title = ""
    if unit_id:
        unit = db.table("units").select("title").eq("id", unit_id).single().execute().data
        unit_title = unit["title"]

    guardian_ids: list[str] = []
    if student_id:
        guardian_ids = [r["guardian_id"] for r in db.table("student_guardians").select("guardian_id").eq("student_id", student_id).execute().data]

    stage("redacting")
    variables = {
        "framework": first["frameworks"]["name"] if first.get("frameworks") else "",
        "subject": first["subjects"]["name"] if first.get("subjects") else "",
        "grade": first["grade"],
        "unit_title": unit_title or "(outcome-based)",
        "periods": periods,
        "period_minutes": period_minutes,
        "outcome_block": "\n".join(f"- {o['ref_code']}: {o['statement']}" for o in outcomes),
        "notes": notes or "(none)",
        "language_name": LANGUAGE_NAMES.get(language, "English"),
    }

    stage("generating")
    result: GenerationResult = generate(
        db, school_id, f"saarthi.{kind}.v1", variables,
        student_ids=[student_id] if student_id else None, guardian_ids=guardian_ids or None,
        actor_id=actor_id, artifact_type="artifact", settings=settings,
    )

    stage("validating")
    body = result.output
    if kind == "parent_message":
        violations = post_validate(body.get("message", "") + " " + body.get("subject", ""))
        if violations:
            raise GuardrailError(violations)

    stage("saving")
    title = body.get("title") or body.get("subject") or f"{kind.replace('_', ' ').title()} — {first['ref_code']}"
    payload = {
        "school_id": school_id, "kind": kind, "title": title, "body": body, "generated_version": body,
        "subject_id": first.get("subject_id"), "grade": first.get("grade"), "framework_id": first.get("framework_id"),
        "unit_id": unit_id, "section_id": section_id, "student_id": student_id, "language": language,
        "origin": "ai_generated", "generation_log_id": result.generation_log_id, "created_by": actor_id,
    }
    artifact_id = db.rpc("create_artifact", {"p_artifact": payload, "p_outcome_ids": [o["id"] for o in outcomes]}).execute().data
    stage("done")
    return {"artifact_id": artifact_id, "title": title, "redaction_count": result.redaction_count, "provider": result.provider, "validation_result": result.validation_result}


def generate_artifact_events(db: Client, school_id: str, actor_id: str | None, kind: str, **kwargs) -> Iterator[dict]:
    """Same as generate_artifact, but yields stage events for the streaming UI."""
    events: list[dict] = []
    stages = ["resolving_outcomes", "redacting", "generating", "validating", "saving", "done"]

    def on_stage(s: str) -> None:
        events.append({"stage": s, "index": stages.index(s), "total": len(stages)})

    # Run synchronously (the model call dominates); emit the stages that were
    # reached before the result, then the result.
    try:
        result = generate_artifact(db, school_id, actor_id, kind, on_stage=on_stage, **kwargs)
        for e in events:
            yield e
        yield {"result": result}
    except GuardrailError as e:
        for ev in events:
            yield ev
        yield {"error": "guardrail", "violations": e.violations}
    except ValueError as e:
        yield {"error": str(e)}


# ---------------------------------------------------------------------------
# Remediation builder (Phase 3 task 7): bank first, generation only for gaps.
# ---------------------------------------------------------------------------

def weak_outcomes_for_section(db: Client, school_id: str, section_id: str, subject_id: str | None, threshold: float = 0.5) -> list[dict]:
    students = [s["id"] for s in db.table("students").select("id").eq("section_id", section_id).execute().data]
    if not students:
        return []
    responses = db.table("responses").select("item_id, marks_obtained, max_marks").eq("school_id", school_id).in_("student_id", students).execute().data
    if not responses:
        return []
    item_ids = list({r["item_id"] for r in responses})
    links = db.table("item_outcomes").select("item_id, learning_outcome_id, learning_outcomes(ref_code, statement, subject_id)").in_("item_id", item_ids).execute().data
    by_item: dict[str, list[dict]] = {}
    for l in links:
        by_item.setdefault(l["item_id"], []).append(l)
    totals: dict[str, list[float]] = {}
    meta: dict[str, dict] = {}
    for r in responses:
        for l in by_item.get(r["item_id"], []):
            lo = l["learning_outcomes"]
            if subject_id and lo.get("subject_id") != subject_id:
                continue
            totals.setdefault(l["learning_outcome_id"], []).append(float(r["marks_obtained"]) / float(r["max_marks"] or 1))
            meta[l["learning_outcome_id"]] = lo
    weak = []
    for oid, vals in totals.items():
        avg = sum(vals) / len(vals)
        if avg < threshold:
            weak.append({"outcome_id": oid, "ref_code": meta[oid]["ref_code"], "statement": meta[oid]["statement"], "avg": round(avg, 3), "attempts": len(vals)})
    return sorted(weak, key=lambda w: w["avg"])


def build_remediation_set(
    db: Client, school_id: str, actor_id: str | None, *, section_id: str, subject_id: str | None,
    weak_outcome_ids: list[str] | None = None, per_outcome: int = 3, generate_for_gaps: bool = True,
    language: str = "en", settings: Settings | None = None,
) -> dict:
    if weak_outcome_ids:
        rows = db.table("learning_outcomes").select("id, ref_code, statement").in_("id", weak_outcome_ids).execute().data
        weak = [{"outcome_id": r["id"], "ref_code": r["ref_code"], "statement": r["statement"], "avg": None, "attempts": 0} for r in rows]
    else:
        weak = weak_outcomes_for_section(db, school_id, section_id, subject_id)
    if not weak:
        raise ValueError("no weak outcomes found for this section")

    plan = []
    gaps = []
    for w in weak:
        links = db.table("item_outcomes").select("item_id, items!inner(id, stem, item_type, marks, status, stimulus, options)").eq("learning_outcome_id", w["outcome_id"]).eq("items.status", "approved").limit(per_outcome).execute().data
        bank_items = [l["items"] for l in links]
        if bank_items:
            plan.append({**w, "source": "bank", "items": bank_items})
        else:
            plan.append({**w, "source": "generated" if generate_for_gaps else "needs_generation", "items": []})
            gaps.append(w)

    generated_block = None
    generation_log_id = None
    if gaps and generate_for_gaps:
        result = generate(
            db, school_id, "saarthi.remediation_set.v1",
            {"framework": "", "subject": "", "grade": "", "outcome_block": "\n".join(f"- {g['ref_code']}: {g['statement']}" for g in gaps),
             "notes": "(none)", "language_name": LANGUAGE_NAMES.get(language, "English")},
            actor_id=actor_id, artifact_type="artifact", settings=settings,
        )
        generation_log_id = result.generation_log_id
        generated_block = result.output
        by_ref = {o["outcome_ref"]: o for o in generated_block.get("outcomes", [])}
        for p in plan:
            if p["source"] == "generated":
                p["generated"] = by_ref.get(p["ref_code"]) or (generated_block["outcomes"][0] if generated_block.get("outcomes") else None)

    first = db.table("learning_outcomes").select("subject_id, grade, framework_id").eq("id", weak[0]["outcome_id"]).single().execute().data
    body = {"weak_outcomes": plan, "bank_first": True, "generated_for": [g["ref_code"] for g in gaps] if generate_for_gaps else [], "needs_generation": [g["ref_code"] for g in gaps] if not generate_for_gaps else []}
    payload = {
        "school_id": school_id, "kind": "remediation_set", "title": f"Remediation set — {len(weak)} weak outcome(s)", "body": body,
        "generated_version": generated_block, "subject_id": first["subject_id"], "grade": first["grade"], "framework_id": first["framework_id"],
        "section_id": section_id, "language": language, "origin": "ai_generated" if generated_block else "teacher_written",
        "generation_log_id": generation_log_id, "created_by": actor_id,
    }
    artifact_id = db.rpc("create_artifact", {"p_artifact": payload, "p_outcome_ids": [w["outcome_id"] for w in weak]}).execute().data
    return {"artifact_id": artifact_id, "weak": len(weak), "from_bank": sum(1 for p in plan if p["source"] == "bank"), "generated": len(gaps) if generate_for_gaps else 0, "needs_generation": [g["ref_code"] for g in gaps] if not generate_for_gaps else [], "plan": plan}


# ---------------------------------------------------------------------------
# PDFs (A4, Devanagari-capable)
# ---------------------------------------------------------------------------

def render_artifact_pdf(db: Client, school_id: str, artifact_id: str, upload: bool = True) -> dict:
    a = db.table("artifacts").select("*, subjects(name), frameworks(code), artifact_outcomes(learning_outcomes(ref_code, frameworks(code)))").eq("id", artifact_id).eq("school_id", school_id).single().execute().data
    school = db.table("schools").select("name").eq("id", school_id).single().execute().data
    chips = [f"{ao['learning_outcomes']['frameworks']['code']} / {ao['learning_outcomes']['ref_code']}" for ao in a["artifact_outcomes"] if ao.get("learning_outcomes")]
    pdf = render_pdf("artifact.html", {"title": a["title"], "school_name": school["name"], "artifact": a, "chips": chips, "lang": a["language"]})
    path = None
    if upload:
        path = upload_pdf(db, "artifacts", school_id, f"saarthi/{artifact_id}.pdf", pdf)
        db.table("artifacts").update({"file_path": path}).eq("id", artifact_id).execute()
    return {"file_path": path, "pdf": pdf}


# ---------------------------------------------------------------------------
# Substitute pack (Phase 6, "My Day"): one PDF a covering teacher can teach
# from -- today's periods for the absent teacher, the unit each class is in,
# and the approved artifacts (lesson plan / worksheet / activity) for it.
# Only approved or shared artifacts are included: nothing unapproved leaves
# the drafting teacher's screen.
# ---------------------------------------------------------------------------

def _artifact_summary(a: dict) -> list[str]:
    body = a.get("body") or {}
    kind = a.get("kind")
    if kind == "lesson_plan":
        return [f"{s.get('minutes', '')} min · {s.get('step', '')}: {s.get('students_do', '')}" for s in body.get("sequence", [])[:6]]
    if kind == "worksheet":
        core = (body.get("levels") or {}).get("core") or {}
        return [q.get("q", "") for q in core.get("questions", [])[:6]]
    if kind == "activity":
        return body.get("steps", [])[:6]
    if kind == "revision_sheet":
        return [p for s in body.get("sections", [])[:2] for p in s.get("key_points", [])[:3]]
    return []


def render_substitute_pack(db: Client, school_id: str, teacher_id: str, weekday: int, upload: bool = True) -> dict:
    teacher = db.table("profiles").select("full_name, schools(name)").eq("id", teacher_id).single().execute().data
    periods = (
        db.table("timetable_periods").select("period_no, starts_at, ends_at, section_id, subject_id, sections(grade, section), subjects(name)")
        .eq("teacher_id", teacher_id).eq("weekday", weekday).order("period_no").execute().data
    )
    rows = []
    for p in periods:
        sec = p.get("sections") or {}
        unit = (
            db.table("units").select("id, title, sequence_no").eq("school_id", school_id).eq("subject_id", p["subject_id"]).eq("grade", sec.get("grade"))
            .order("sequence_no", desc=True).limit(1).execute().data
        )
        unit = unit[0] if unit else None
        q = db.table("artifacts").select("id, kind, title, body").eq("school_id", school_id).in_("status", ["approved", "shared"]).eq("subject_id", p["subject_id"]).eq("grade", sec.get("grade")).in_("kind", ["lesson_plan", "worksheet", "activity", "revision_sheet"]).order("approved_at", desc=True).limit(3)
        arts = q.execute().data
        rows.append({
            "period": p["period_no"], "time": f"{str(p['starts_at'])[:5]}–{str(p['ends_at'])[:5]}",
            "klass": f"Grade {sec.get('grade')}{sec.get('section')}", "subject": (p.get("subjects") or {}).get("name"),
            "unit": unit, "artifacts": [{"kind": a["kind"].replace("_", " "), "title": a["title"], "lines": _artifact_summary(a)} for a in arts],
        })
    day = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday]
    pdf = render_pdf("substitute_pack.html", {
        "title": f"Substitute pack · {day}", "school_name": (teacher.get("schools") or {}).get("name", ""),
        "teacher": teacher["full_name"], "day": day, "rows": rows,
    })
    path = None
    if upload:
        path = upload_pdf(db, "artifacts", school_id, f"substitute/{teacher_id}-{weekday}.pdf", pdf)
    return {"path": path, "periods": len(rows), "bytes": len(pdf)}
