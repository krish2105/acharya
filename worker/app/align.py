"""
Alignment engine (Section 6.3): nearest-neighbour concept proposals above
0.82 cosine similarity; LLM-assisted relation labelling for the 0.65-0.82
band, schema-validated through the gateway; everything lands as a proposal
in the human confirmation queue. This module never writes 'human_confirmed'.
"""

from dataclasses import dataclass

from supabase import Client

from .config import Settings
from .embed import embed_texts
from .gateway import GatewayError, generate

HI = 0.82
LO = 0.65
RELATIONS = ("equivalent", "partial", "prerequisite", "extends")


@dataclass(frozen=True)
class ConceptMatch:
    concept_id: str
    title: str
    similarity: float


def rank_concepts(db: Client, school_id: str, embedding: list[float], k: int = 5) -> list[ConceptMatch]:
    rows = db.rpc("match_concepts", {"p_school_id": school_id, "p_embedding": embedding, "p_k": k}).execute().data
    return [ConceptMatch(r["concept_id"], r["title"], float(r["similarity"])) for r in rows]


def rank_concepts_for_text(db: Client, school_id: str, text: str, k: int = 5) -> list[ConceptMatch]:
    return rank_concepts(db, school_id, embed_texts([text])[0], k)


def label_relation(db: Client, school_id: str, outcome_statement: str, concept_title: str, concept_description: str | None,
                   settings: Settings | None = None) -> dict:
    """Outcome-only prompt (no student data), schema-validated. Returns
    {"relation": ..., "justification": ...}; relation may be 'unrelated'."""
    result = generate(
        db,
        school_id,
        "align.relation.v1",
        {
            "outcome_statement": outcome_statement,
            "concept_title": concept_title,
            "concept_description": concept_description or "(no description)",
        },
        artifact_type="alignment",
        settings=settings,
    )
    return result.output


def propose_alignments(
    db: Client,
    school_id: str,
    outcome_ids: list[str] | None = None,
    k: int = 5,
    use_llm: bool = True,
    settings: Settings | None = None,
) -> dict:
    q = db.table("learning_outcomes").select("id, statement, embedding").eq("school_id", school_id).not_.is_("embedding", "null")
    if outcome_ids:
        q = q.in_("id", outcome_ids)
    outcomes = q.execute().data

    ids = [o["id"] for o in outcomes]
    existing: dict[str, set[str]] = {}
    if ids:
        for row in db.table("outcome_concepts").select("learning_outcome_id, concept_id").in_("learning_outcome_id", ids).execute().data:
            existing.setdefault(row["learning_outcome_id"], set()).add(row["concept_id"])

    stats = {"outcomes": len(outcomes), "embedding_suggested": 0, "llm_suggested": 0, "llm_unrelated": 0, "llm_failed": 0, "skipped_existing": 0}

    for o in outcomes:
        emb = o["embedding"]
        if isinstance(emb, str):
            emb = [float(x) for x in emb.strip("[]").split(",")]
        for m in rank_concepts(db, school_id, emb, k):
            if m.concept_id in existing.get(o["id"], set()):
                stats["skipped_existing"] += 1
                continue
            if m.similarity >= HI:
                db.table("outcome_concepts").insert({
                    "learning_outcome_id": o["id"], "concept_id": m.concept_id,
                    "confidence": round(m.similarity, 4), "method": "embedding_suggested",
                }).execute()
                existing.setdefault(o["id"], set()).add(m.concept_id)
                stats["embedding_suggested"] += 1
            elif LO <= m.similarity < HI and use_llm:
                try:
                    concept = db.table("concepts").select("description").eq("id", m.concept_id).single().execute().data
                    label = label_relation(db, school_id, o["statement"], m.title, concept.get("description"), settings)
                except GatewayError:
                    stats["llm_failed"] += 1
                    continue
                if label.get("relation") in RELATIONS:
                    db.table("outcome_concepts").insert({
                        "learning_outcome_id": o["id"], "concept_id": m.concept_id,
                        "confidence": round(m.similarity, 4), "method": "llm_suggested",
                        "justification": f"{label['relation']}: {label.get('justification', '')}",
                    }).execute()
                    existing.setdefault(o["id"], set()).add(m.concept_id)
                    stats["llm_suggested"] += 1
                else:
                    stats["llm_unrelated"] += 1
    return stats
