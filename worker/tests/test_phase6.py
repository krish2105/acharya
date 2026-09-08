"""Phase 6 acceptance: notifications, DPDP export/erasure, substitute pack,
leadership PDF. All against the live local stack (Supabase + Mailpit)."""

import json
import uuid

import httpx
import pdfplumber
import pytest

from app.dpdp import export_student
from app.leadership import render_leadership_report
from app.notify import enqueue_now, flush
from app.saarthi import render_substitute_pack
from tests.conftest import KALANJALI_SCHOOL_ID

TEACHER = "d0000000-0000-0000-0000-000000000001"
MAILPIT = "http://127.0.0.1:54344"


def _pdf_text(data: bytes) -> str:
    import io
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return "\n".join((p.extract_text() or "") for p in pdf.pages)


def test_digests_enqueue_and_deliver_without_student_names(db):
    counts = enqueue_now(db)
    assert counts["hod_digests"] >= 1 or counts["descriptor_reminders"] >= 1
    out = flush(db)
    assert out["sent"] >= 1 and out["failed"] == 0
    msgs = httpx.get(f"{MAILPIT}/api/v1/messages", timeout=10).json()["messages"]
    assert msgs, "Mailpit received nothing"
    body = httpx.get(f"{MAILPIT}/api/v1/message/{msgs[0]['ID']}", timeout=10).json()["Text"]
    names = [r["full_name"] for r in db.table("students").select("full_name").eq("school_id", KALANJALI_SCHOOL_ID).limit(200).execute().data]
    assert not any(n in body for n in names)
    assert "KAL-2026" not in body


def test_dpdp_export_contains_only_that_student(db):
    students = db.table("students").select("id, full_name, admission_no").eq("school_id", KALANJALI_SCHOOL_ID).gte("admission_no", "KAL-2026-0001").lte("admission_no", "KAL-2026-0003").order("admission_no").execute().data
    me, other = students[0], students[1]
    out = export_student(db, KALANJALI_SCHOOL_ID, me["id"], upload=True)
    dump = json.dumps(out["document"], ensure_ascii=False, default=str)
    assert me["full_name"] in dump and me["admission_no"] in dump
    assert other["full_name"] not in dump and other["admission_no"] not in dump
    assert out["counts"]["observations"] >= 1 and out["counts"]["consent_records"] >= 1
    assert out["path"].startswith(f"{KALANJALI_SCHOOL_ID}/dpdp/")


def test_erasure_anonymises_student_and_deletes_personal_records(db):
    sid, gid = str(uuid.uuid4()), str(uuid.uuid4())
    db.table("students").insert({"id": sid, "school_id": KALANJALI_SCHOOL_ID, "admission_no": "KAL-ERASE-1", "full_name": "Erase Me Test", "dob": "2014-01-01", "section_id": "c0000000-0000-0000-0000-000000000001"}).execute()
    db.table("guardians").insert({"id": gid, "school_id": KALANJALI_SCHOOL_ID, "full_name": "Erase Guardian", "phone": "9800000000", "email": "erase@example.test"}).execute()
    db.table("student_guardians").insert({"student_id": sid, "guardian_id": gid, "relation": "parent", "is_primary": True}).execute()
    db.table("observations").insert({"school_id": KALANJALI_SCHOOL_ID, "student_id": sid, "teacher_id": TEACHER, "domain": "cognitive", "note": "test", "observed_on": "2026-08-01"}).execute()
    req = db.table("erasure_requests").insert({"school_id": KALANJALI_SCHOOL_ID, "student_id": sid, "requested_by_guardian": gid, "reason": "test"}).execute().data[0]
    with pytest.raises(Exception):
        db.rpc("execute_erasure", {"p_request_id": req["id"]}).execute()   # must be approved first
    db.table("erasure_requests").update({"status": "approved"}).eq("id", req["id"]).execute()
    db.rpc("execute_erasure", {"p_request_id": req["id"]}).execute()
    s = db.table("students").select("full_name, admission_no, is_active").eq("id", sid).single().execute().data
    assert s["full_name"] == "Erased student" and s["admission_no"].startswith("ERASED-") and s["is_active"] is False
    assert db.table("observations").select("id").eq("student_id", sid).execute().data == []
    assert db.table("guardians").select("id").eq("id", gid).execute().data == []
    assert db.table("erasure_requests").select("status").eq("id", req["id"]).single().execute().data["status"] == "executed"
    db.table("students").delete().eq("id", sid).execute()   # leave the seed cohort as found


def test_substitute_pack_only_contains_approved_material(db):
    out = render_substitute_pack(db, KALANJALI_SCHOOL_ID, TEACHER, 1)
    assert out["periods"] >= 3
    full = _pdf_text(db.storage.from_("artifacts").download(out["path"]))
    assert "Period 1" in full
    approved = (db.table("artifacts").select("title").eq("school_id", KALANJALI_SCHOOL_ID).in_("status", ["approved", "shared"]).eq("grade", "6")
                .in_("kind", ["lesson_plan", "worksheet", "activity", "revision_sheet"]).order("approved_at", desc=True).limit(1).execute().data)
    assert approved and approved[0]["title"] in full
    drafts = db.table("artifacts").select("title").eq("school_id", KALANJALI_SCHOOL_ID).eq("status", "draft").limit(20).execute().data
    assert drafts and all(d["title"] not in full for d in drafts)


def test_leadership_report_renders(db):
    summary = {"windowDays": 90, "generations": 12, "valid": 12, "approvals": 9, "approvers": 3, "teachers": 180, "redactions": 40, "minutesSaved": 300, "avgLatencyMs": 1200,
               "byModule": [{"module": "SAARTHI", "generations": 12, "valid": 12}], "byType": [{"type": "artifact", "approvals": 9, "asGenerated": 2, "medianEdit": 14, "minutesEach": 35, "minutesSaved": 315}],
               "editBuckets": [{"bucket": "Approved as generated", "count": 2}], "byProvider": [{"provider": "ollama", "count": 12}], "byWeek": []}
    out = render_leadership_report(db, KALANJALI_SCHOOL_ID, summary, upload=True)
    text = _pdf_text(db.storage.from_("artifacts").download(out["path"]))
    assert "AI usage" in text and "assumptions" in text.lower() and "SAARTHI" in text
