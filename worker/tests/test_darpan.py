import os

import pytest
from postgrest.exceptions import APIError
from supabase import create_client

from app import providers
from app.darpan import descriptor_violations, draft_descriptor, render_hpc_report
from app.saarthi import GuardrailError
from tests.conftest import KALANJALI_SCHOOL_ID

TEACHER = "d0000000-0000-0000-0000-000000000001"
TERM = "T1 2026-27"
ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"


def _student(db, admission_no):
    return db.table("students").select("id, full_name, admission_no, dob").eq("school_id", KALANJALI_SCHOOL_ID).eq("admission_no", admission_no).single().execute().data


def _login(email):
    c = create_client(os.environ.get("SUPABASE_URL", "http://127.0.0.1:54341"), ANON)
    c.auth.sign_in_with_password({"email": email, "password": "Demo@2026"})
    return c


def test_descriptor_post_validation_rejects_comparative_language():
    """Phase 4 acceptance: a draft with comparative language is rejected."""
    assert descriptor_violations("[STUDENT_1] is better than most of the class at reading.")
    assert descriptor_violations("One of the weakest in maths this term.")
    assert descriptor_violations("She has a shy personality and will struggle with public speaking.")
    assert descriptor_violations("Reads confidently; next term, aim to summarise a chapter in three sentences.") == []


def test_descriptor_guardrail_rejects_comparative_model_output(db, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    monkeypatch.setattr(providers.OllamaProvider, "complete", lambda self, s, u: providers.ProviderResult(
        "ollama", "fake", '{"strengths": ["[STUDENT_1] is one of the weakest readers in the class"], "growth_areas": ["Needs a diagnosis"], "next_step": "Will struggle next term"}', 5, 5))
    st = _student(db, "KAL-2026-0006")
    with pytest.raises(GuardrailError) as exc:
        draft_descriptor(db, KALANJALI_SCHOOL_ID, TEACHER, student_id=st["id"], term=TERM, domain="cognitive")
    assert exc.value.violations


def test_report_blocked_while_any_descriptor_is_unapproved(db):
    """Phase 4 acceptance: a report cannot generate while any domain descriptor is unapproved."""
    st = _student(db, "KAL-2026-0004")   # 3 approved + 1 draft (psychomotor)
    with pytest.raises(APIError) as exc:
        render_hpc_report(db, KALANJALI_SCHOOL_ID, st["id"], TERM, TEACHER, upload=False)
    assert "not yet approved" in str(exc.value)

    # approve the last domain through the ledger, then the report renders
    d = db.table("hpc_descriptors").select("id, generated_text, final_text").eq("student_id", st["id"]).eq("term", TERM).eq("domain", "psychomotor").single().execute().data
    db.table("approvals").insert({"school_id": KALANJALI_SCHOOL_ID, "artifact_type": "descriptor", "artifact_id": d["id"], "generated_version": d["generated_text"], "final_version": d["final_text"], "edit_distance": 0, "approved_by": TEACHER}).execute()
    db.table("hpc_descriptors").update({"status": "approved", "approved_by": TEACHER, "approved_at": "now()"}).eq("id", d["id"]).execute()
    result = render_hpc_report(db, KALANJALI_SCHOOL_ID, st["id"], TERM, TEACHER, upload=True)
    assert result["pdf"][:4] == b"%PDF" and result["stage"] == "middle"
    # cleanup: back to draft so the seed state (report block demo) survives
    db.table("hpc_reports").delete().eq("student_id", st["id"]).eq("term", TERM).execute()
    db.table("hpc_descriptors").update({"status": "draft", "approved_by": None, "approved_at": None}).eq("id", d["id"]).execute()
    db.table("approvals").delete().eq("artifact_type", "descriptor").eq("artifact_id", d["id"]).execute()


def test_descriptor_cannot_be_approved_without_approvals_row(db):
    st = _student(db, "KAL-2026-0004")
    d = db.table("hpc_descriptors").select("id").eq("student_id", st["id"]).eq("term", TERM).eq("domain", "psychomotor").single().execute().data
    with pytest.raises(APIError) as exc:
        db.table("hpc_descriptors").update({"status": "approved"}).eq("id", d["id"]).execute()
    assert "cannot enter status" in str(exc.value)


def test_parent_sees_only_own_childs_released_report(db):
    """Phase 4 acceptance: a parent cannot fetch another child's report."""
    parent = _login("parent@kalanjali.demo")
    own = _student(db, "KAL-2026-0001")
    other = _student(db, "KAL-2026-0002")   # generated but unreleased, and not this parent's child
    rows = parent.table("hpc_reports").select("student_id, released_to_parent_at").execute().data
    assert rows and {r["student_id"] for r in rows} == {own["id"]}
    assert all(r["released_to_parent_at"] for r in rows)
    assert parent.table("hpc_reports").select("id").eq("student_id", other["id"]).execute().data == []
    # and the parent can read only their own child's student row
    assert {s["id"] for s in parent.table("students").select("id").execute().data} == {own["id"]}
    # descriptors/observations are teacher-facing: nothing leaks to a parent
    assert parent.table("observations").select("id").execute().data == []
    assert parent.table("hpc_descriptors").select("id").execute().data == []


def test_peer_input_is_anonymous_to_student_and_attributed_to_teacher(db):
    """Phase 4 acceptance: peer input is anonymous to the receiving student and
    attributed only in the teacher view."""
    student = _login("student@kalanjali.demo")
    me = _student(db, "KAL-2026-0002")
    # base table: a student only ever sees their own self-assessment rows
    base = student.table("hpc_inputs").select("source, submitted_by_student").execute().data
    assert base and all(r["source"] == "self" for r in base)
    # anonymised view: peer feedback about me, with no author column at all
    peer = student.table("hpc_peer_feedback_for_student").select("*").execute().data
    assert peer and all(r["student_id"] == me["id"] for r in peer)
    assert "submitted_by_student" not in peer[0] and "submitted_by" not in peer[0]
    # teacher view: attributed
    teacher = _login("teacher@kalanjali.demo")
    rows = teacher.table("hpc_inputs").select("source, submitted_by_student").eq("student_id", me["id"]).eq("source", "peer").execute().data
    assert rows and rows[0]["submitted_by_student"]


def test_super_admin_cannot_read_darpan_content(db):
    sa = _login("super@acharya.demo")
    assert sa.table("observations").select("id").execute().data == []
    assert sa.table("hpc_descriptors").select("id").execute().data == []
    assert sa.table("hpc_reports").select("id").execute().data == []


@pytest.mark.requires_ollama
def test_descriptor_prompt_contains_no_pii(db, monkeypatch):
    """Phase 4 acceptance: descriptor prompt for a seeded student contains no
    name, admission number or DOB."""
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    st = _student(db, "KAL-2026-0005")
    guardian = db.table("student_guardians").select("guardians(full_name, phone)").eq("student_id", st["id"]).single().execute().data["guardians"]
    # a teacher typed the child's name into an observation note -- redaction must still strip it
    db.table("observations").insert({"school_id": KALANJALI_SCHOOL_ID, "student_id": st["id"], "teacher_id": TEACHER, "domain": "cognitive", "context": "lab",
                                     "note": f"{st['full_name']} explained the germination result clearly to the group."}).execute()
    captured = []
    original = providers.OllamaProvider.complete
    monkeypatch.setattr(providers.OllamaProvider, "complete", lambda self, s, u: (captured.append(s + "\n" + u), original(self, s, u))[1])
    result = draft_descriptor(db, KALANJALI_SCHOOL_ID, TEACHER, student_id=st["id"], term=TERM, domain="cognitive")
    assert captured
    for prompt in captured:
        assert st["full_name"] not in prompt and st["full_name"].split()[0] not in prompt
        assert st["admission_no"] not in prompt and st["dob"] not in prompt
        assert guardian["full_name"] not in prompt and guardian["phone"] not in prompt
        assert "[STUDENT_1]" in prompt
    assert result["redaction_count"] >= 1
    assert descriptor_violations(result["text"]) == []
