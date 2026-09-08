import io

import pdfplumber

from app.uday import render_evidence_pack
from tests.conftest import KALANJALI_SCHOOL_ID

SECTION_6A = "c0000000-0000-0000-0000-000000000001"


def test_class6_section_at_64_hours_shows_36_hour_shortfall_and_projection(db):
    """Phase 5 acceptance: hours dashboard for a seeded Class 6 section at 64
    delivered hours shows a 36-hour shortfall and the correct projection."""
    rows = db.rpc("uday_hours_dashboard", {"p_school_id": KALANJALI_SCHOOL_ID, "p_academic_year": "2026-27", "p_as_of": "2026-09-30"}).execute().data
    row = next(r for r in rows if r["section_id"] == SECTION_6A)
    assert float(row["required_hours"]) == 100 and float(row["delivered_hours"]) == 64.0
    assert float(row["shortfall"]) == 36.0
    weeks = float(row["weeks_elapsed"])
    expected = round(64.0 / weeks * 36, 1)
    assert abs(float(row["projected_hours"]) - expected) < 0.2
    assert float(row["projected_shortfall"]) == round(max(0, 100 - expected), 1)
    assert row["sessions"] == 96


def test_every_unit_has_an_unplugged_variant(db):
    """Phase 5 acceptance: every unit has at least one unplugged activity variant."""
    units = db.table("ct_ai_units").select("id, grade, title, ct_ai_activities(mode)").eq("school_id", KALANJALI_SCHOOL_ID).execute().data
    assert len(units) >= 6 * 10
    for u in units:
        assert any(a["mode"] == "unplugged" for a in u["ct_ai_activities"]), f"{u['grade']} {u['title']} has no unplugged variant"
    # and the scheme sums to the mandate per grade
    totals = {}
    for u in db.table("ct_ai_units").select("grade, planned_hours").eq("school_id", KALANJALI_SCHOOL_ID).execute().data:
        totals[u["grade"]] = totals.get(u["grade"], 0) + float(u["planned_hours"])
    assert {g: round(t, 1) for g, t in totals.items()} == {"3": 50.0, "4": 50.0, "5": 50.0, "6": 100.0, "7": 100.0, "8": 100.0}


def test_unplugged_variant_cannot_be_removed(db):
    unit = db.table("ct_ai_units").select("id").eq("school_id", KALANJALI_SCHOOL_ID).eq("grade", "3").eq("sequence_no", 1).single().execute().data
    act = db.table("ct_ai_activities").select("id").eq("unit_id", unit["id"]).eq("mode", "unplugged").single().execute().data
    from postgrest.exceptions import APIError
    import pytest
    with pytest.raises(APIError) as exc:
        db.table("ct_ai_activities").delete().eq("id", act["id"]).execute()
    assert "unplugged" in str(exc.value)


def test_evidence_pack_pdf_has_all_five_sections(db):
    """Phase 5 acceptance: the evidence pack PDF generates with all five sections."""
    r = render_evidence_pack(db, KALANJALI_SCHOOL_ID, "6", "2026-27", upload=True)
    assert r["pdf"][:4] == b"%PDF" and len(r["sections"]) == 5
    with pdfplumber.open(io.BytesIO(r["pdf"])) as doc:
        text = " ".join(p.extract_text() or "" for p in doc.pages)
    for i, s in enumerate(r["sections"], start=1):
        assert f"{i}. {s}" in text, f"section missing: {s}"
    assert "64" in text and "36" in text
    assert r["file_path"].startswith(KALANJALI_SCHOOL_ID + "/uday/")
