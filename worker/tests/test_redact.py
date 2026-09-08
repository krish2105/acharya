from app.redact import load_entities, redact, resubstitute
from tests.conftest import KALANJALI_SCHOOL_ID


def test_no_student_pii_in_any_constructed_prompt(db):
    """Phase 0 acceptance test: for the 50 seeded students, no student name,
    admission number, phone or DOB appears in any constructed prompt."""
    students = (
        db.table("students")
        .select("id, full_name, admission_no, dob")
        .eq("school_id", KALANJALI_SCHOOL_ID)
        .gte("admission_no", "KAL-2026-0001").lte("admission_no", "KAL-2026-0050")   # the 50 seeded in Phase 0
        .execute()
        .data
    )
    assert len(students) == 50

    student_guardians = (
        db.table("student_guardians").select("student_id, guardian_id").execute().data
    )
    guardian_by_student = {sg["student_id"]: sg["guardian_id"] for sg in student_guardians}

    checked = 0
    for student in students:
        guardian_id = guardian_by_student.get(student["id"])
        entities = load_entities(
            db,
            KALANJALI_SCHOOL_ID,
            student_ids=[student["id"]],
            guardian_ids=[guardian_id] if guardian_id else [],
        )
        guardian = None
        for e in entities:
            if e.placeholder.startswith("[GUARDIAN"):
                guardian = e
                break

        # A realistic constructed prompt: everything a SAARTHI parent-message
        # generator would interpolate about this student.
        built_prompt = (
            f"Write a warm note to the guardian of {student['full_name']} "
            f"(admission number {student['admission_no']}, DOB {student['dob']}). "
        )
        if guardian:
            built_prompt += f"Guardian: {guardian.name}, phone {guardian.phone}, email {guardian.email}. "

        redacted, count = redact(built_prompt, entities)

        assert student["full_name"] not in redacted
        assert student["admission_no"] not in redacted
        assert student["dob"] not in redacted
        if guardian:
            assert guardian.name not in redacted
            if guardian.phone:
                assert guardian.phone not in redacted
            if guardian.email:
                assert guardian.email not in redacted
        assert count > 0

        # And re-substitution restores the name for the final human-facing output.
        restored = resubstitute(redacted, entities)
        assert student["full_name"] in restored

        checked += 1

    assert checked == 50
