import uuid

import pdfplumber
import pytest
from postgrest.exceptions import APIError

from app import providers
from app.pdf import render_pdf
from app.saarthi import GuardrailError, build_remediation_set, generate_artifact, post_validate
from tests.conftest import KALANJALI_SCHOOL_ID

TEACHER = "d0000000-0000-0000-0000-000000000001"
SCI = "b0000000-0000-0000-0000-000000000001"
SECTION_10A = "c0000000-0000-0000-0000-000000000005"


def _outcome(fw, ref):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "acharya/setu/" + "/".join(["outcome", fw, ref])))


def test_artifact_without_outcome_link_cannot_be_saved(db):
    """Phase 3 acceptance: a generated worksheet without an outcome link cannot be saved."""
    with pytest.raises(APIError) as exc:
        db.table("artifacts").insert({
            "school_id": KALANJALI_SCHOOL_ID, "kind": "worksheet", "title": "Orphan worksheet", "body": {"levels": {}},
            "origin": "teacher_written", "created_by": TEACHER,
        }).execute()
    assert "at least one learning outcome" in str(exc.value)
    with pytest.raises(APIError):
        db.rpc("create_artifact", {"p_artifact": {"school_id": KALANJALI_SCHOOL_ID, "kind": "worksheet", "title": "x", "body": {}}, "p_outcome_ids": []}).execute()


def test_artifact_cannot_be_approved_without_approvals_row(db):
    aid = db.rpc("create_artifact", {"p_artifact": {"school_id": KALANJALI_SCHOOL_ID, "kind": "activity", "title": "Gate test", "body": {"steps": []}, "created_by": TEACHER},
                                     "p_outcome_ids": [_outcome("CBSE", "CBSE.SCI.10.1.1")]}).execute().data
    with pytest.raises(APIError) as exc:
        db.table("artifacts").update({"status": "approved"}).eq("id", aid).execute()
    assert "cannot enter status" in str(exc.value)


def test_post_validation_rejects_comparative_and_diagnostic_language():
    assert post_validate("Asha is better than the rest of the class.")
    assert post_validate("We suspect a learning disability and recommend a diagnosis.")
    assert post_validate("She will never manage fractions.")
    assert post_validate("आरव बाकी कक्षा से बेहतर है।")
    assert post_validate("Aarav read three pages aloud with confidence this week. At home, try five minutes of reading before dinner.") == []


def test_remediation_builder_uses_bank_first_and_flags_gaps(db):
    """Phase 3 acceptance: bank items first; generation only for the outcome with an empty bank."""
    with_bank = _outcome("CBSE", "CBSE.SCI.10.1.1")      # 19 approved items
    empty_bank = _outcome("CBSE", "CBSE.SST.9.1.1")       # no items at all
    result = build_remediation_set(
        db, KALANJALI_SCHOOL_ID, TEACHER, section_id=SECTION_10A, subject_id=None,
        weak_outcome_ids=[with_bank, empty_bank], generate_for_gaps=False,
    )
    plan = {p["outcome_id"]: p for p in result["plan"]}
    assert plan[with_bank]["source"] == "bank" and len(plan[with_bank]["items"]) == 3
    assert plan[empty_bank]["source"] == "needs_generation" and plan[empty_bank]["items"] == []
    assert result["from_bank"] == 1 and result["needs_generation"] == ["CBSE.SST.9.1.1"]
    # weak-outcome detection from real response data also works for the seeded section
    from app.saarthi import weak_outcomes_for_section
    weak = weak_outcomes_for_section(db, KALANJALI_SCHOOL_ID, SECTION_10A, SCI)
    assert weak and all(w["avg"] < 0.5 for w in weak)


def test_hindi_worksheet_pdf_shapes_devanagari():
    """Phase 3 acceptance: a Hindi worksheet renders in the PDF with Devanagari
    shaping (an embedded Devanagari font, extractable Hindi text)."""
    body = {
        "title": "भिन्न और दशमलव — अभ्यास पत्रक",
        "levels": {
            "support": {"instructions": "प्रत्येक प्रश्न को ध्यान से पढ़ें।", "questions": [{"q": "३/४ को दशमलव में लिखिए।", "marks": 1}, {"q": "०.५ को भिन्न में बदलिए।", "marks": 1}, {"q": "१/२ + १/४ = ?", "marks": 1}]},
            "core": {"instructions": "चरण दिखाइए।", "questions": [{"q": "२/३ और ३/५ की तुलना कीजिए।", "marks": 2}, {"q": "०.७५ को सरलतम भिन्न में लिखिए।", "marks": 2}, {"q": "५/८ − १/४ = ?", "marks": 2}]},
            "extension": {"instructions": "तर्क सहित उत्तर दीजिए।", "questions": [{"q": "एक कक्षा में ३/५ छात्र लड़कियाँ हैं; यदि १८ लड़कियाँ हैं तो कुल छात्र कितने?", "marks": 3}, {"q": "०.३३३… को भिन्न के रूप में व्यक्त कीजिए।", "marks": 3}, {"q": "दो दशमलव संख्याओं का उदाहरण दीजिए जिनका योग १ हो।", "marks": 3}]},
        },
        "answer_key": [{"level": "support", "answers": ["०.७५", "१/२", "३/४"]}],
    }
    pdf = render_pdf("artifact.html", {"title": body["title"], "school_name": "Kalanjali International School, Jaipur", "lang": "hi", "chips": ["CBSE / CBSE.MATH.6.1.1"],
                                       "artifact": {"kind": "worksheet", "body": body, "grade": "6", "language": "hi", "differentiation_level": None, "subjects": {"name": "गणित"}, "frameworks": {"code": "CBSE"}}})
    assert pdf[:4] == b"%PDF"
    import io
    with pdfplumber.open(io.BytesIO(pdf)) as doc:
        text = "".join(p.extract_text() or "" for p in doc.pages)
        fonts = {f.get("fontname", "") for p in doc.pages for f in p.chars}
    assert any("ऀ" <= ch <= "ॿ" for ch in text), "no Devanagari text extracted"
    assert any("Devanagari" in f for f in fonts), f"Devanagari font not embedded: {fonts}"
    # a conjunct with a virama must survive shaping/extraction (e.g. 'प्रश्न' -> प + ् + र ...)
    assert "प्र" in text or "प्" in text


@pytest.mark.requires_ollama
def test_parent_message_round_trip_never_leaks_name_into_prompt(db, monkeypatch):
    """Phase 3 acceptance: the real name appears in the final output and never in
    the constructed prompt (both asserted)."""
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    student = db.table("students").select("id, full_name").eq("school_id", KALANJALI_SCHOOL_ID).eq("admission_no", "KAL-2026-0003").single().execute().data
    guardian = db.table("student_guardians").select("guardians(full_name, phone)").eq("student_id", student["id"]).single().execute().data["guardians"]
    name = student["full_name"]

    captured: list[str] = []
    original = providers.OllamaProvider.complete

    def spy(self, system_prompt, user_prompt):
        captured.append(system_prompt + "\n" + user_prompt)
        return original(self, system_prompt, user_prompt)

    monkeypatch.setattr(providers.OllamaProvider, "complete", spy)

    notes = f"{name} read three pages aloud with real confidence this week and helped a classmate. Parent {guardian['full_name']} ({guardian['phone']}) asked how to support reading at home."
    result = generate_artifact(db, KALANJALI_SCHOOL_ID, TEACHER, "parent_message", outcome_ids=[_outcome("CBSE", "CBSE.ENG.6.1.1")],
                               student_id=student["id"], notes=notes)
    assert captured, "provider was not called"
    for prompt in captured:
        assert name not in prompt and name.split()[0] not in prompt
        assert guardian["full_name"] not in prompt and guardian["phone"] not in prompt
        assert "[STUDENT_1]" in prompt
    assert result["redaction_count"] >= 2

    artifact = db.table("artifacts").select("body, kind, status").eq("id", result["artifact_id"]).single().execute().data
    assert artifact["status"] == "draft"
    assert name in artifact["body"]["message"] or name.split()[0] in artifact["body"]["message"]
    assert post_validate(artifact["body"]["message"]) == []


@pytest.mark.requires_ollama
def test_guardrail_rejects_comparative_output(db, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    monkeypatch.setattr(providers.OllamaProvider, "complete", lambda self, s, u: providers.ProviderResult(
        "ollama", "fake", '{"subject": "Update", "message": "[STUDENT_1] is doing better than the rest of the class and we suspect a learning disability."}', 10, 10))
    student = db.table("students").select("id").eq("school_id", KALANJALI_SCHOOL_ID).eq("admission_no", "KAL-2026-0004").single().execute().data
    with pytest.raises(GuardrailError):
        generate_artifact(db, KALANJALI_SCHOOL_ID, TEACHER, "parent_message", outcome_ids=[_outcome("CBSE", "CBSE.ENG.6.1.1")], student_id=student["id"], notes="notes")


@pytest.mark.requires_ollama
def test_generate_lesson_plan_from_unit_and_hindi_worksheet(db, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    unit_id = str(uuid.uuid5(uuid.NAMESPACE_URL, "acharya/setu/unit/u-6-1"))
    plan = generate_artifact(db, KALANJALI_SCHOOL_ID, TEACHER, "lesson_plan", unit_id=unit_id, section_id="c0000000-0000-0000-0000-000000000001")
    row = db.table("artifacts").select("body, unit_id, artifact_outcomes(learning_outcome_id)").eq("id", plan["artifact_id"]).single().execute().data
    assert row["unit_id"] == unit_id and len(row["artifact_outcomes"]) == 4 and row["body"]["sequence"]

    ws = generate_artifact(db, KALANJALI_SCHOOL_ID, TEACHER, "worksheet", outcome_ids=[_outcome("CBSE", "CBSE.MATH.6.1.1")], language="hi")
    body = db.table("artifacts").select("body, language").eq("id", ws["artifact_id"]).single().execute().data
    text = body["body"]["title"] + " " + body["body"]["levels"]["core"]["instructions"]
    assert body["language"] == "hi" and any("ऀ" <= ch <= "ॿ" for ch in text)
