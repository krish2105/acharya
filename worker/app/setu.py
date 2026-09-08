"""SETU service functions used by the API routes and tests."""

from supabase import Client

from .pdf import render_pdf, upload_pdf


def build_transition_report(db: Client, school_id: str, student_id: str, to_framework_code: str, target_grade: str,
                            upload: bool = True) -> dict:
    student = (
        db.table("students").select("id, full_name, admission_no, previous_framework_id, frameworks(code, name)")
        .eq("school_id", school_id).eq("id", student_id).single().execute().data
    )
    if not student.get("previous_framework_id"):
        raise ValueError("student has no previous framework recorded")
    frameworks = {f["code"]: f for f in db.table("frameworks").select("id, code, name").execute().data}
    to_fw = frameworks[to_framework_code]
    from_fw = next(f for f in frameworks.values() if f["id"] == student["previous_framework_id"])

    report = db.rpc("compute_transition_gaps", {
        "p_school_id": school_id, "p_from_framework": from_fw["id"], "p_to_framework": to_fw["id"], "p_target_grade": target_grade,
    }).execute().data
    school = db.table("schools").select("name").eq("id", school_id).single().execute().data

    pdf = render_pdf("transition_report.html", {
        "title": "Board transition gap report",
        "school_name": school["name"],
        "student_name": student["full_name"],
        "admission_no": student["admission_no"],
        "from_framework": from_fw["name"],
        "to_framework": to_fw["code"],
        "target_grade": target_grade,
        "gaps": report["gaps"],
        "compared": report["compared_outcomes"],
        "not_comparable": report["not_comparable_subjects"],
    })

    file_path = None
    if upload:
        file_path = upload_pdf(db, "artifacts", school_id, f"transition/{student_id}-{to_framework_code}-{target_grade}.pdf", pdf)

    row = db.table("transition_reports").insert({
        "school_id": school_id, "student_id": student_id, "from_framework_id": from_fw["id"],
        "to_framework_id": to_fw["id"], "target_grade": target_grade, "gaps": report, "file_path": file_path,
    }).execute().data[0]
    return {"report": row, "pdf_bytes": len(pdf), "pdf": pdf}
