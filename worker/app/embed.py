"""
Local embeddings (Section 4: sentence-transformers into pgvector, no paid
embedding API). all-MiniLM-L6-v2 produces 384-dim vectors, matching the
`vector(384)` columns on concepts and learning_outcomes.
"""

from functools import lru_cache

from supabase import Client

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache
def get_model():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(MODEL_NAME)


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    return get_model().encode(texts, normalize_embeddings=True, batch_size=64, show_progress_bar=False).tolist()


def _embed_rows(db: Client, table: str, rows: list[dict], text_of) -> int:
    vectors = embed_texts([text_of(r) for r in rows])
    for row, vec in zip(rows, vectors):
        db.table(table).update({"embedding": vec}).eq("id", row["id"]).execute()
    return len(rows)


def embed_outcomes(db: Client, school_id: str, only_missing: bool = True) -> int:
    q = db.table("learning_outcomes").select("id, ref_code, statement").eq("school_id", school_id)
    if only_missing:
        q = q.is_("embedding", "null")
    rows = q.execute().data
    return _embed_rows(db, "learning_outcomes", rows, lambda r: r["statement"])


def embed_concepts(db: Client, school_id: str, only_missing: bool = True) -> int:
    q = db.table("concepts").select("id, title, description").eq("school_id", school_id)
    if only_missing:
        q = q.is_("embedding", "null")
    rows = q.execute().data
    return _embed_rows(db, "concepts", rows, lambda r: r["title"] + (f". {r['description']}" if r.get("description") else ""))
