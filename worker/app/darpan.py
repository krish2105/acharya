"""
DARPAN (Section 6.6): descriptor drafting from redacted evidence only, with a
post-validation that rejects comparative, diagnostic, personality or
predictive language; stage-specific HPC report PDFs that the database refuses
to generate while any descriptor is unapproved.
"""

import re
from collections import defaultdict

from supabase import Client

from .config import Settings
from .gateway import generate
from .pdf import render_pdf, upload_pdf
from .saarthi import GuardrailError, LANGUAGE_NAMES, post_validate

DOMAIN_LABEL = {"cognitive": "Learning and understanding", "affective": "Attitudes, values and interests",
                "socio_emotional": "Working with others", "psychomotor": "Physical skills and creativity"}

# Descriptor-specific additions to the shared prohibitions: personality claims
# and intelligence labels are not evidence, they are verdicts.
DESCRIPTOR_PROHIBITED = [
    r"\bpersonality\b", r"\bintrovert", r"\bextrovert", r"\bgifted\b", r"\bgenius\b", r"\bintelligen", r"\btalented child\b",
    r"\baverage student\b", r"\bweak student\b", r"\bbright student\b", r"\bnaughty\b", r"\bproblem child\b",
    r"\bhas potential\b", r"\bwill do well\b", r"\bwill struggle\b",
    r"बुद्धिमान", r"औसत छात्र", r"कमज़ोर छात्र", r"होशियार",
]


def descriptor_violations(text: str) -> list[str]:
    lowered = text.lower()
    return post_validate(text) + [p for p in DESCRIPTOR_PROHIBITED if re.search(p, lowered)]


def gather_evidence(db: Client, school_id: str, student_id: str, term: str, domain: str) -> dict:
    """Everything the model is allowed to see, before redaction. Names are
    deliberately not fetched here; the gateway's redaction pass strips any that
    a teacher typed into a note."""
    obs = db.table("observations").select("note, context, observed_on, domain").eq("student_id", student_id).order("observed_on", desc=True).limit(40).execute().data
    inputs = db.table("hpc_inputs").select("source, responses").eq("student_id", student_id).eq("term", term).execute().data

    # outcome-linked performance for the child only (never other students' marks)
    responses = db.table("responses").select("item_id, marks_obtained, max_marks").eq("student_id", student_id).execute().data
    perf: dict[str, list[float]] = defaultdict(list)
    if responses:
        links = db.table("item_outcomes").select("item_id, learning_outcomes(ref_code, statement)").in_("item_id", [r["item_id"] for r in responses]).execute().data
        by_item: dict[str, list[dict]] = defaultdict(list)
        for l in links:
            by_item[l["item_id"]].append(l["learning_outcomes"])
        for r in responses:
            for lo in by_item.get(r["item_id"], []):
                perf[f"{lo['ref_code']}: {lo['statement']}"].append(float(r["marks_obtained"]) / float(r["max_marks"] or 1))
    perf_lines = [f"- {k} — {round(sum(v) / len(v) * 100)}% of marks across {len(v)} question(s)" for k, v in perf.items()]

    domain_obs = [o for o in obs if o["domain"] == domain] or obs
    return {
        "observations": [f"- ({o['observed_on']}, {o['context'] or 'class'}) {o['note']}" for o in domain_obs[:12]],
        "performance": perf_lines[:10] if domain == "cognitive" else [],
        "inputs": [f"- {i['source']}: " + "; ".join(f"{k}: {v}" for k, v in i["responses"].items()) for i in inputs],
    }


def draft_descriptor(db: Client, school_id: str, actor_id: str | None, *, student_id: str, term: str, domain: str,
                     language: str = "en", settings: Settings | None = None) -> dict:
    if domain not in DOMAIN_LABEL:
        raise ValueError("unknown domain")
    student = db.table("students").select("id, section_id, sections(grade)").eq("id", student_id).eq("school_id", school_id).single().execute().data
    stage_row = db.table("hpc_stages").select("stage, grades").eq("school_id", school_id).execute().data
    grade = student["sections"]["grade"] if student.get("sections") else ""
    stage = next((s["stage"] for s in stage_row if grade in s["grades"]), "middle")
    guardian_ids = [r["guardian_id"] for r in db.table("student_guardians").select("guardian_id").eq("student_id", student_id).execute().data]

    ev = gather_evidence(db, school_id, student_id, term, domain)
    if not (ev["observations"] or ev["inputs"] or ev["performance"]):
        raise ValueError("no evidence recorded for this child yet — descriptors are drafted from teacher observations and 360 inputs, never from nothing")
    evidence = "\n".join(
        (["Teacher observations:"] + ev["observations"] if ev["observations"] else [])
        + (["Outcome-linked performance (this child only):"] + ev["performance"] if ev["performance"] else [])
        + (["360-degree inputs:"] + ev["inputs"] if ev["inputs"] else [])
    )

    result = generate(
        db, school_id, "darpan.descriptor.v1",
        {"stage": stage, "term": term, "domain": domain, "domain_label": DOMAIN_LABEL[domain], "evidence": evidence, "language_name": LANGUAGE_NAMES.get(language, "English")},
        student_ids=[student_id], guardian_ids=guardian_ids or None, actor_id=actor_id, artifact_type="descriptor", settings=settings,
    )
    out = result.output
    prose = " ".join(out["strengths"]) + " " + " ".join(out["growth_areas"]) + " Next step: " + out["next_step"]
    violations = descriptor_violations(prose)
    if violations:
        raise GuardrailError(violations)

    row = db.table("hpc_descriptors").upsert({
        "school_id": school_id, "student_id": student_id, "term": term, "domain": domain, "generated_text": prose,
        "generated_json": out, "final_text": prose, "status": "draft", "language": language,
        "generation_log_id": result.generation_log_id, "drafted_by": actor_id,
    }, on_conflict="student_id,term,domain").execute().data[0]
    return {"descriptor_id": row["id"], "text": prose, "redaction_count": result.redaction_count, "stage": stage}


def render_hpc_report(db: Client, school_id: str, student_id: str, term: str, actor_id: str | None = None, upload: bool = True) -> dict:
    student = db.table("students").select("id, full_name, admission_no, sections(grade, section)").eq("id", student_id).eq("school_id", school_id).single().execute().data
    grade = student["sections"]["grade"] if student.get("sections") else ""
    stages = db.table("hpc_stages").select("stage, grades, template").eq("school_id", school_id).execute().data
    stage_row = next((s for s in stages if grade in s["grades"]), None)
    if not stage_row:
        raise ValueError(f"no HPC stage template covers grade {grade}")
    stage = stage_row["stage"]

    # The database gate runs on this upsert: unapproved or missing descriptors abort here.
    report = db.table("hpc_reports").upsert({
        "school_id": school_id, "student_id": student_id, "term": term, "stage": stage, "generated_at": "now()", "generated_by": actor_id,
    }, on_conflict="student_id,term").execute().data[0]

    descriptors = db.table("hpc_descriptors").select("domain, final_text, generated_json, language").eq("student_id", student_id).eq("term", term).eq("status", "approved").execute().data
    domains = db.table("hpc_domains").select("domain, label, label_hi").eq("school_id", school_id).eq("stage", stage).execute().data
    inputs = db.table("hpc_inputs").select("source, responses").eq("student_id", student_id).eq("term", term).execute().data
    observations = db.table("observations").select("note, context, observed_on, domain").eq("student_id", student_id).order("observed_on", desc=True).limit(8).execute().data
    school = db.table("schools").select("name").eq("id", school_id).single().execute().data

    # scholastic: per-outcome mastery for THIS child only, expressed per outcome (rule 2.1.3)
    responses = db.table("responses").select("item_id, marks_obtained, max_marks").eq("student_id", student_id).execute().data
    scholastic = []
    if responses:
        links = db.table("item_outcomes").select("item_id, learning_outcomes(ref_code, statement, subjects(name))").in_("item_id", [r["item_id"] for r in responses]).execute().data
        by_item: dict[str, list[dict]] = defaultdict(list)
        for l in links:
            by_item[l["item_id"]].append(l["learning_outcomes"])
        agg: dict[str, list[float]] = defaultdict(list)
        meta: dict[str, dict] = {}
        for r in responses:
            for lo in by_item.get(r["item_id"], []):
                agg[lo["ref_code"]].append(float(r["marks_obtained"]) / float(r["max_marks"] or 1))
                meta[lo["ref_code"]] = lo
        for ref, vals in sorted(agg.items()):
            pct = round(sum(vals) / len(vals) * 100)
            scholastic.append({"ref": ref, "statement": meta[ref]["statement"], "subject": (meta[ref].get("subjects") or {}).get("name", ""),
                               "band": "Secure" if pct >= 75 else ("Developing" if pct >= 45 else "Emerging")})

    peer = [i["responses"] for i in inputs if i["source"] == "peer"]     # anonymised: no author on the report
    self_ = next((i["responses"] for i in inputs if i["source"] == "self"), None)
    parent = next((i["responses"] for i in inputs if i["source"] == "parent"), None)
    lang = descriptors[0]["language"] if descriptors else "en"

    pdf = render_pdf("hpc_report.html", {
        "title": "Holistic Progress Card", "school_name": school["name"], "lang": lang, "student": student, "grade": grade,
        "section": student["sections"]["section"] if student.get("sections") else "", "term": term, "stage": stage,
        "sections": stage_row["template"]["sections"], "domains": domains,
        "descriptors": {d["domain"]: d for d in descriptors}, "scholastic": scholastic, "observations": observations,
        "self_input": self_, "peer_inputs": peer, "parent_input": parent,
    })
    path = None
    if upload:
        path = upload_pdf(db, "artifacts", school_id, f"hpc/{student_id}-{term.replace(' ', '_')}.pdf", pdf)
        db.table("hpc_reports").update({"file_path": path}).eq("id", report["id"]).execute()
    return {"report_id": report["id"], "file_path": path, "pdf": pdf, "stage": stage}
