"""
PII redaction (Section 2.2 rule 7, Section 6.2 redaction rule).

This is context-aware known-value substitution, not general free-text PII
detection: a generation request is always tied to specific student_id /
guardian_id rows, so their exact name, admission number, phone, email and
date of birth are looked up and replaced with stable placeholders
([STUDENT_1], [GUARDIAN_1], ...) before the prompt is sent to any model.
Placeholders are re-substituted with the entity's name (the form that
actually belongs in generated prose) after the model returns.
"""

from dataclasses import dataclass

from supabase import Client


@dataclass(frozen=True)
class RedactedEntity:
    placeholder: str
    name: str
    admission_no: str | None = None
    dob: str | None = None
    phone: str | None = None
    email: str | None = None


def load_entities(
    db: Client, school_id: str, student_ids: list[str], guardian_ids: list[str]
) -> list[RedactedEntity]:
    entities: list[RedactedEntity] = []

    if student_ids:
        rows = (
            db.table("students")
            .select("id, full_name, admission_no, dob")
            .eq("school_id", school_id)
            .in_("id", student_ids)
            .execute()
            .data
        )
        # Preserve caller order so placeholders are stable across a request.
        by_id = {r["id"]: r for r in rows}
        for i, sid in enumerate(student_ids, start=1):
            r = by_id.get(sid)
            if r is None:
                continue
            entities.append(
                RedactedEntity(
                    placeholder=f"[STUDENT_{i}]",
                    name=r["full_name"],
                    admission_no=r["admission_no"],
                    dob=r["dob"],
                )
            )

    if guardian_ids:
        rows = (
            db.table("guardians")
            .select("id, full_name, phone, email")
            .eq("school_id", school_id)
            .in_("id", guardian_ids)
            .execute()
            .data
        )
        by_id = {r["id"]: r for r in rows}
        for i, gid in enumerate(guardian_ids, start=1):
            r = by_id.get(gid)
            if r is None:
                continue
            entities.append(
                RedactedEntity(
                    placeholder=f"[GUARDIAN_{i}]",
                    name=r["full_name"],
                    phone=r.get("phone"),
                    email=r.get("email"),
                )
            )

    return entities


def redact(text: str, entities: list[RedactedEntity]) -> tuple[str, int]:
    """Replaces every known PII value with its entity's placeholder.
    Returns (redacted_text, redaction_count)."""
    pairs: list[tuple[str, str]] = []
    for e in entities:
        for value in (e.name, e.admission_no, e.dob, e.phone, e.email):
            if value:
                pairs.append((value, e.placeholder))

    # Longest values first so a shorter value can't shadow a longer one
    # that contains it (e.g. a first name that's a substring of a full name).
    pairs.sort(key=lambda vp: -len(vp[0]))

    count = 0
    for value, placeholder in pairs:
        occurrences = text.count(value)
        if occurrences:
            text = text.replace(value, placeholder)
            count += occurrences

    return text, count


def resubstitute(text: str, entities: list[RedactedEntity]) -> str:
    """Replaces each entity's placeholder with its name, for the final
    human-facing output."""
    for e in entities:
        text = text.replace(e.placeholder, e.name)
    return text
