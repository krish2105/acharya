"""UDAY programme evidence pack (Phase 5 task 8): scheme of work, hours
delivered, activity library coverage, sample student work, CPD coverage --
inspection- or affiliation-file-ready."""

from supabase import Client

from .pdf import render_pdf, upload_pdf


def render_evidence_pack(db: Client, school_id: str, grade: str, academic_year: str, upload: bool = True) -> dict:
    school = db.table("schools").select("name").eq("id", school_id).single().execute().data
    units = db.table("ct_ai_units").select("id, sequence_no, title, big_idea, planned_hours, strand, ct_ai_activities(title, mode, duration_minutes)").eq("school_id", school_id).eq("grade", grade).order("sequence_no").execute().data
    dashboard = [d for d in db.rpc("uday_hours_dashboard", {"p_school_id": school_id, "p_academic_year": academic_year}).execute().data if d["grade"] == grade]
    section_ids = [d["section_id"] for d in dashboard]
    ledger = db.table("ct_ai_hours_ledger").select("delivered_on, minutes, note, sections(grade, section), ct_ai_activities(title, mode)").in_("section_id", section_ids).eq("academic_year", academic_year).order("delivered_on").execute().data if section_ids else []
    unit_ids = [u["id"] for u in units]
    projects = db.table("ct_ai_projects").select("title, rubric_scores, teacher_comment, assessed_on, students(full_name)").in_("unit_id", unit_ids).not_.is_("assessed_on", "null").limit(12).execute().data if unit_ids else []
    cpd = db.table("cpd_records").select("activity, theme, hours, completed_on, profiles(full_name)").eq("school_id", school_id).order("completed_on").execute().data
    teachers = db.table("profiles").select("id", count="exact").eq("school_id", school_id).eq("role", "teacher").execute().count or 0

    modes = {"unplugged": 0, "plugged": 0, "hybrid": 0}
    for u in units:
        for a in u["ct_ai_activities"]:
            modes[a["mode"]] += 1
    sections = ["Scheme of work", "Hours delivered", "Activity library", "Sample student work", "Teacher CPD coverage"]

    pdf = render_pdf("uday_evidence_pack.html", {
        "title": f"AI & Computational Thinking — Class {grade} programme evidence pack",
        "school_name": school["name"], "grade": grade, "academic_year": academic_year, "units": units, "dashboard": dashboard,
        "ledger": ledger, "projects": projects, "cpd": cpd, "teachers": teachers, "modes": modes, "pack_sections": sections,
        "required": 50 if grade in ("3", "4", "5") else 100,
    })
    path = None
    if upload:
        path = upload_pdf(db, "cpd", school_id, f"uday/evidence-pack-grade-{grade}-{academic_year}.pdf", pdf)
    return {"file_path": path, "pdf": pdf, "sections": sections, "units": len(units)}
