"""
DPDP Act 2023 data-subject rights: export everything held about one student as
a single JSON document (right of access), and execute an approved erasure
request (right to erasure) through the DB function that anonymises the
student row and deletes personal records while keeping append-only audit ids.
"""

import json
from datetime import datetime, timezone

from supabase import Client

# (table, column that identifies the student)
STUDENT_TABLES = [
    ("consent_records", "student_id"),
    ("observations", "student_id"),
    ("hpc_inputs", "student_id"),
    ("hpc_descriptors", "student_id"),
    ("hpc_reports", "student_id"),
    ("responses", "student_id"),
    ("ct_ai_projects", "student_id"),
    ("transition_reports", "student_id"),
    ("artifacts", "student_id"),
    ("erasure_requests", "student_id"),
]


def export_student(db: Client, school_id: str, student_id: str, upload: bool = True) -> dict:
    student = db.table("students").select("*").eq("id", student_id).eq("school_id", school_id).single().execute().data
    guardians = db.table("student_guardians").select("relation, is_primary, guardians(full_name, phone, email)").eq("student_id", student_id).execute().data
    doc: dict = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "basis": "DPDP Act 2023, s.11 right to access",
        "student": student,
        "guardians": guardians,
    }
    counts = {}
    for table, col in STUDENT_TABLES:
        rows = db.table(table).select("*").eq(col, student_id).execute().data
        doc[table] = rows
        counts[table] = len(rows)
    # Peer feedback the student authored about classmates is their own content,
    # but the classmate's identity is not theirs to receive: strip it.
    authored = db.table("hpc_inputs").select("term, responses, submitted_at").eq("submitted_by_student", student_id).eq("source", "peer").execute().data
    doc["peer_feedback_authored"] = authored
    counts["peer_feedback_authored"] = len(authored)
    payload = json.dumps(doc, ensure_ascii=False, indent=2, default=str).encode()
    path = None
    if upload:
        path = f"{school_id}/dpdp/export-{student_id}.json"
        db.storage.from_("evidence").upload(path, payload, {"content-type": "application/json", "upsert": "true"})
    return {"path": path, "counts": counts, "bytes": len(payload), "document": doc}


def execute_erasure(db: Client, request_id: str) -> dict:
    db.rpc("execute_erasure", {"p_request_id": request_id}).execute()
    row = db.table("erasure_requests").select("status, executed_at, student_id").eq("id", request_id).single().execute().data
    return row
