import csv
from pathlib import Path

import pytest

from app.align import label_relation, propose_alignments, rank_concepts, rank_concepts_for_text
from app.embed import embed_concepts, embed_outcomes, embed_texts
from app.importer import import_outcomes, parse_csv
from app.setu import build_transition_report
from tests.conftest import KALANJALI_SCHOOL_ID

FIXTURES = Path(__file__).parent / "fixtures"
RIVERMIST_SCHOOL_ID = "a0000000-0000-0000-0000-000000000002"
SECTION_6A = "c0000000-0000-0000-0000-000000000001"
YEAR = "2026-27"


def _fw(db, code):
    return db.table("frameworks").select("id").eq("code", code).single().execute().data["id"]


def test_import_400_outcomes_embedded_and_searchable(db):
    """Phase 1 acceptance: import 400 outcomes across four frameworks; every one
    embedded and searchable. Imports into the second tenant so it exercises the
    importer end to end (subjects and school_frameworks created on the fly)."""
    rows = parse_csv((FIXTURES / "outcomes_400.csv").read_bytes())
    assert len(rows) == 400
    result = import_outcomes(db, RIVERMIST_SCHOOL_ID, rows, "outcomes_400.csv")
    assert result["upserted"] == 400 and result["skipped"] == 0

    embed_outcomes(db, RIVERMIST_SCHOOL_ID)
    total = db.table("learning_outcomes").select("id", count="exact").eq("school_id", RIVERMIST_SCHOOL_ID).execute().count
    embedded = (
        db.table("learning_outcomes").select("id", count="exact").eq("school_id", RIVERMIST_SCHOOL_ID)
        .not_.is_("embedding", "null").execute().count
    )
    assert total == 400 and embedded == 400

    frameworks = db.table("learning_outcomes").select("framework_id").eq("school_id", RIVERMIST_SCHOOL_ID).execute().data
    assert len({r["framework_id"] for r in frameworks}) >= 4

    probe = rows[17]
    vec = embed_texts([probe.statement])[0]
    hits = db.rpc("match_outcomes", {"p_school_id": RIVERMIST_SCHOOL_ID, "p_embedding": vec, "p_k": 3}).execute().data
    assert hits and hits[0]["ref_code"] == probe.ref_code


def test_alignment_fixture_top3_and_no_auto_confirm(db):
    """Phase 1 acceptance: 60 known cross-framework equivalents, >= 80% surfaced in
    the top-3 proposals, zero auto-confirmed without a human."""
    embed_concepts(db, KALANJALI_SCHOOL_ID)
    embed_outcomes(db, KALANJALI_SCHOOL_ID)

    with (FIXTURES / "equivalents_60.csv").open() as f:
        pairs = list(csv.DictReader(f))
    assert len(pairs) == 60

    outcomes = {
        (o["ref_code"], o["framework_id"]): o
        for o in db.table("learning_outcomes").select("id, ref_code, framework_id, statement, embedding")
        .eq("school_id", KALANJALI_SCHOOL_ID).execute().data
    }
    fw_ids = {f["code"]: f["id"] for f in db.table("frameworks").select("id, code").execute().data}

    checked, hits = 0, 0
    probe_ids = []
    for p in pairs:
        for side in ("a", "b"):
            o = outcomes[(p[f"outcome_{side}_ref"], fw_ids[p[f"outcome_{side}_framework"]])]
            probe_ids.append(o["id"])
            emb = o["embedding"]
            if isinstance(emb, str):
                emb = [float(x) for x in emb.strip("[]").split(",")]
            top3 = rank_concepts(db, KALANJALI_SCHOOL_ID, emb, k=3)
            checked += 1
            if any(m.title == p["concept_title"] for m in top3):
                hits += 1
    rate = hits / checked
    print(f"top-3 hit rate: {hits}/{checked} = {rate:.2%}")
    assert rate >= 0.80

    before = db.table("outcome_concepts").select("learning_outcome_id", count="exact").eq("method", "human_confirmed").execute().count
    stats = propose_alignments(db, KALANJALI_SCHOOL_ID, outcome_ids=probe_ids, use_llm=False)
    after = db.table("outcome_concepts").select("learning_outcome_id", count="exact").eq("method", "human_confirmed").execute().count
    assert after == before, "the engine must never auto-confirm"
    assert stats["outcomes"] == len(set(probe_ids))


def test_coverage_ignores_unconfirmed_links(db):
    """Phase 1 acceptance: coverage ignores unconfirmed links -- adding an
    embedding_suggested link leaves coverage unchanged; confirming it does not."""
    def coverage():
        rows = db.rpc("effective_coverage", {"p_school_id": KALANJALI_SCHOOL_ID, "p_section_id": SECTION_6A, "p_academic_year": YEAR}).execute().data
        return {r["learning_outcome_id"]: r for r in rows}

    base = coverage()
    covered_direct = [oid for oid, r in base.items() if r["via_outcome_id"] is None]
    assert covered_direct
    # a confirmed concept of a directly-covered outcome
    link = (
        db.table("outcome_concepts").select("learning_outcome_id, concept_id").eq("method", "human_confirmed")
        .in_("learning_outcome_id", covered_direct).limit(1).execute().data[0]
    )
    # an outcome with no links at all, in the same tenant, not covered
    linked_ids = {r["learning_outcome_id"] for r in db.table("outcome_concepts").select("learning_outcome_id").execute().data}
    candidate = next(
        o["id"] for o in db.table("learning_outcomes").select("id").eq("school_id", KALANJALI_SCHOOL_ID).execute().data
        if o["id"] not in linked_ids and o["id"] not in base
    )

    db.table("outcome_concepts").insert({"learning_outcome_id": candidate, "concept_id": link["concept_id"], "confidence": 0.9, "method": "embedding_suggested"}).execute()
    try:
        after_suggest = coverage()
        assert set(after_suggest) == set(base), "an unconfirmed link changed coverage"

        db.table("outcome_concepts").update({
            "method": "human_confirmed", "confirmed_by": "d0000000-0000-0000-0000-000000000002", "confirmed_at": "2026-09-01T00:00:00Z",
        }).eq("learning_outcome_id", candidate).eq("concept_id", link["concept_id"]).execute()
        after_confirm = coverage()
        assert candidate in after_confirm and after_confirm[candidate]["via_outcome_id"] == link["learning_outcome_id"]
    finally:
        db.table("outcome_concepts").delete().eq("learning_outcome_id", candidate).eq("concept_id", link["concept_id"]).execute()


def test_transition_report_lists_planted_gaps(db):
    """Phase 1 acceptance: the seeded Cambridge -> CBSE Class 9 student's report
    lists the 7 planted gaps (and renders a PDF)."""
    student = db.table("students").select("id").eq("school_id", KALANJALI_SCHOOL_ID).eq("admission_no", "KAL-2026-0007").single().execute().data
    result = build_transition_report(db, KALANJALI_SCHOOL_ID, student["id"], "CBSE", "9", upload=True)
    report = result["report"]
    gaps = report["gaps"]["gaps"]
    assert len(gaps) == 7
    assert {g["subject"] for g in gaps} <= {"Science", "Mathematics"}
    assert set(report["gaps"]["not_comparable_subjects"]) == {"English", "Social Science"}
    assert result["pdf"][:4] == b"%PDF" and result["pdf_bytes"] > 5000
    assert report["file_path"].startswith(KALANJALI_SCHOOL_ID + "/transition/")


@pytest.mark.requires_ollama
def test_llm_relation_labelling_is_schema_valid(db, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    out = label_relation(db, KALANJALI_SCHOOL_ID,
                         "Explain photosynthesis: light-dependent reactions with reference to a labelled diagram.",
                         "Photosynthesis: light-dependent reactions", None)
    assert out["relation"] in ("equivalent", "partial", "prerequisite", "extends", "unrelated")
    assert isinstance(out["justification"], str)


def test_rank_concepts_for_text_returns_related_concept(db):
    embed_concepts(db, KALANJALI_SCHOOL_ID)
    top = rank_concepts_for_text(db, KALANJALI_SCHOOL_ID, "Students explain how enzymes speed up reactions and what affects their rate.", k=3)
    assert any("Enzymes" in m.title for m in top)
