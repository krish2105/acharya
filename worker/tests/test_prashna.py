import json
import uuid
from pathlib import Path

import pytest
from postgrest.exceptions import APIError

from app.items import generate_items
from app.papers import assemble_paper, create_improvement_paper, render_paper_pdfs
from tests.conftest import KALANJALI_SCHOOL_ID

FIXTURES = Path(__file__).parent / "fixtures"
SECTION_10A = "c0000000-0000-0000-0000-000000000005"
TEACHER = "d0000000-0000-0000-0000-000000000001"
SCI = "b0000000-0000-0000-0000-000000000001"


def _uid(*parts):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "acharya/prashna/" + "/".join(parts)))


def _outcome(fw, ref):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "acharya/setu/" + "/".join(["outcome", fw, ref])))


def _fw(db, code):
    return db.table("frameworks").select("id").eq("code", code).single().execute().data["id"]


def test_item_with_zero_outcome_links_is_rejected_by_db(db):
    """Phase 2 acceptance: an item saved with zero outcome links is rejected."""
    with pytest.raises(APIError) as exc:
        db.table("items").insert({
            "school_id": KALANJALI_SCHOOL_ID, "subject_id": SCI, "framework_id": _fw(db, "CBSE"), "grade": "10",
            "item_type": "mcq", "stem": "Orphan item with no outcome", "answer_key": {"correct": "A"}, "marks": 1,
            "cognitive_level": "apply", "origin": "teacher_written", "created_by": TEACHER,
        }).execute()
    assert "at least one learning outcome" in str(exc.value)

    with pytest.raises(APIError):
        db.rpc("create_item", {"p_item": {"school_id": KALANJALI_SCHOOL_ID, "subject_id": SCI, "grade": "10", "item_type": "mcq",
                                          "stem": "Orphan via rpc", "answer_key": {"correct": "A"}, "marks": 1,
                                          "cognitive_level": "apply"}, "p_outcome_ids": []}).execute()


def test_item_cannot_reach_approved_without_approvals_row(db):
    """Phase 2 acceptance: the approval gate on items."""
    draft = db.table("items").select("id").eq("school_id", KALANJALI_SCHOOL_ID).eq("status", "draft").limit(1).single().execute().data
    with pytest.raises(APIError) as exc:
        db.table("items").update({"status": "approved"}).eq("id", draft["id"]).execute()
    assert "cannot enter status" in str(exc.value)


def test_paper_assembly_against_cbse_2026_blueprint(db):
    """Phase 2 acceptance: within +-2 marks of target and +-3% competency, or the
    exact shortfall is reported."""
    result = assemble_paper(
        db, KALANJALI_SCHOOL_ID, blueprint_id=_uid("bp", "bp-cbse-2026"), section_id=SECTION_10A,
        title="Assembly test — CBSE 10 Science", exam_kind="mock", actor_id=TEACHER,
    )
    c = result["compliance"]
    print(f"assembled {c['items']} items, {c['total_marks']}/{c['target_marks']} marks, competency {c['competency_pct']}% (target {c['competency_target']}%), shortfalls={result['shortfalls']}")
    if result["shortfalls"]:
        for s in result["shortfalls"]:
            assert s["short_by"] > 0 and "section" in s
    else:
        assert abs(c["total_marks"] - c["target_marks"]) <= 2
        assert abs(c["competency_pct"] - c["competency_target"]) <= 3
    assert c["items"] == 35

    files = render_paper_pdfs(db, KALANJALI_SCHOOL_ID, result["paper_id"])
    assert set(files) == {"question", "key", "scheme", "compliance"}


def test_paper_assembly_reports_exact_shortfall_when_bank_is_thin(db):
    """The IGCSE blueprint against the thin IGCSE grade-10 pool must name each
    short slot precisely rather than quietly producing a shorter paper."""
    result = assemble_paper(
        db, KALANJALI_SCHOOL_ID, blueprint_id=_uid("bp", "bp-igcse"), section_id=None,
        title="Shortfall test — IGCSE", exam_kind="mock", actor_id=TEACHER,
    )
    assert result["shortfalls"], "expected shortfalls for the thin IGCSE bank"
    for s in result["shortfalls"]:
        assert s["needed"] > s["available"] and s["short_by"] == s["needed"] - s["available"]
        assert s["item_types"] and s["marks_each"] > 0


def test_calibration_flags_the_four_planted_items(db):
    """Phase 2 acceptance: calibration on seeded response data flags the 4
    planted mislabelled-difficulty items."""
    planted = set(json.loads((FIXTURES / "planted_mislabelled.json").read_text()))
    db.rpc("run_item_calibration", {"p_school_id": KALANJALI_SCHOOL_ID}).execute()
    flagged = {r["item_id"] for r in db.table("item_stats").select("item_id").eq("school_id", KALANJALI_SCHOOL_ID).eq("flagged", True).execute().data}
    assert planted <= flagged
    assert flagged == planted, f"extra flags beyond the planted four: {flagged - planted}"
    for row in db.table("item_stats").select("item_id, facility, difficulty_observed").in_("item_id", list(planted)).execute().data:
        assert row["difficulty_observed"] == "hard" and float(row["facility"]) < 0.4


def test_improvement_paper_covers_same_outcomes_with_zero_overlap(db):
    """Phase 2 acceptance: the improvement paper covers the same outcome set as
    its main paper with zero item overlap."""
    main_id = _uid("paper", "paper-main")
    result = create_improvement_paper(db, KALANJALI_SCHOOL_ID, main_id, TEACHER)
    assert not any(s.get("kind") == "outcome_coverage" for s in result["shortfalls"]), result["shortfalls"]

    main_items = {r["item_id"] for r in db.table("paper_items").select("item_id").eq("paper_id", main_id).execute().data}
    imp_items = {r["item_id"] for r in db.table("paper_items").select("item_id").eq("paper_id", result["paper_id"]).execute().data}
    assert main_items and imp_items and not (main_items & imp_items)

    def outcomes(ids):
        return {r["learning_outcome_id"] for r in db.table("item_outcomes").select("learning_outcome_id").in_("item_id", list(ids)).execute().data}

    assert outcomes(main_items) == outcomes(imp_items)
    paper = db.table("papers").select("paired_with, exam_kind").eq("id", result["paper_id"]).single().execute().data
    assert paper["paired_with"] == main_id and paper["exam_kind"] == "improvement_practice"


@pytest.mark.requires_ollama
def test_generate_20_case_based_items_land_as_linked_drafts(db, monkeypatch):
    """Phase 2 acceptance: generate 20 case-based items for a seeded outcome:
    all schema-valid, all outcome-linked, all landing as draft."""
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    outcome = _outcome("CBSE", "CBSE.SCI.10.1.1")
    result = generate_items(
        db, KALANJALI_SCHOOL_ID, TEACHER, subject_id=SCI, grade="10", framework_id=_fw(db, "CBSE"),
        outcome_ids=[outcome], item_type="case_based", count=20, bloom="analyse",
    )
    assert result["count"] == 20
    rows = db.table("items").select("id, status, item_type, stem, answer_key, marks").in_("id", result["item_ids"]).execute().data
    assert len(rows) == 20 and all(r["status"] == "draft" and r["item_type"] == "case_based" for r in rows)
    links = db.table("item_outcomes").select("item_id").eq("learning_outcome_id", outcome).in_("item_id", result["item_ids"]).execute().data
    assert len(links) == 20
    logs = db.table("generation_log").select("validation_result").in_("id", result["generation_log_ids"]).execute().data
    assert logs and all(l["validation_result"] in ("valid", "retried_valid") for l in logs)
