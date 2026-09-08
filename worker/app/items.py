"""
PRASHNA item generation (Section 6.4 item generation flow). No student data
is ever in these prompts; every generated item lands as a draft linked to the
requested outcomes via create_item(), which the DB refuses without links.
"""

from supabase import Client

from .config import Settings
from .gateway import generate

BATCH = 5
DEFAULT_MARKS = {"mcq": 1, "assertion_reason": 1, "short_answer": 2, "numerical": 2, "diagram": 3, "long_answer": 5,
                 "case_based": 4, "source_based": 4, "competency_cluster": 4}
ITEM_TYPES = tuple(DEFAULT_MARKS)


def generate_items(
    db: Client, school_id: str, actor_id: str | None, *, subject_id: str, grade: str, framework_id: str,
    outcome_ids: list[str], item_type: str, count: int, bloom: str = "apply", marks: float | None = None,
    chapter_text: str | None = None, settings: Settings | None = None,
) -> dict:
    if item_type not in ITEM_TYPES:
        raise ValueError(f"unknown item type {item_type}")
    if not outcome_ids:
        raise ValueError("at least one learning outcome is required")

    outcomes = db.table("learning_outcomes").select("id, ref_code, statement, frameworks(code, name)").in_("id", outcome_ids).eq("school_id", school_id).execute().data
    if not outcomes:
        raise ValueError("outcomes not found")
    subject = db.table("subjects").select("name").eq("id", subject_id).single().execute().data
    framework = db.table("frameworks").select("code, name").eq("id", framework_id).single().execute().data
    marks = marks or DEFAULT_MARKS[item_type]

    outcome_block = "\n".join(f"- {o['ref_code']}: {o['statement']}" for o in outcomes)
    chapter_block = f"Chapter text to draw context from (do not copy verbatim):\n{chapter_text[:4000]}" if chapter_text else ""

    created: list[str] = []
    logs: list[int] = []
    remaining = count
    # Models occasionally return one item fewer than asked; count what actually
    # landed and top up with another bounded call rather than trusting the ask.
    max_calls = (count + BATCH - 1) // BATCH + 3
    calls = 0
    while remaining > 0 and calls < max_calls:
        calls += 1
        n = min(BATCH, remaining)
        result = generate(
            db, school_id, f"item.{item_type}.v1",
            {"framework": framework["name"], "subject": subject["name"], "grade": grade, "outcome_block": outcome_block,
             "item_type": item_type, "bloom": bloom, "marks": marks, "count": n, "chapter_block": chapter_block},
            actor_id=actor_id, artifact_type="item", settings=settings,
        )
        logs.append(result.generation_log_id)
        batch_items = result.output["items"][:n]
        for it in batch_items:
            payload = {
                "school_id": school_id, "subject_id": subject_id, "framework_id": framework_id, "grade": grade,
                "item_type": item_type, "stem": it["stem"], "stimulus": it.get("stimulus"), "options": it.get("options"),
                "parts": it.get("parts"), "answer_key": it["answer_key"], "marking_scheme": it["marking_scheme"],
                "marks": it.get("marks") or marks, "cognitive_level": it.get("cognitive_level") or bloom,
                "difficulty_intended": it.get("difficulty_intended") or "medium", "origin": "ai_generated",
                "status": "draft", "created_by": actor_id, "generation_log_id": result.generation_log_id,
            }
            item_id = db.rpc("create_item", {"p_item": payload, "p_outcome_ids": outcome_ids}).execute().data
            created.append(item_id)
        remaining -= len(batch_items)

    return {"item_ids": created, "count": len(created), "generation_log_ids": logs}
