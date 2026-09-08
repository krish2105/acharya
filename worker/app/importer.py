"""
Framework ingestion (Section 8, Phase 1 task 2): CSV and PDF import of
outcome sets with column/section mapping. Rows are upserted on
(school_id, framework_id, ref_code); missing subjects and school_frameworks
rows are created so a fresh tenant can import a framework in one step.
"""

import io
import re
from dataclasses import dataclass

import pandas as pd
from supabase import Client

COLUMN_ALIASES = {
    "framework_code": ["framework_code", "framework", "board"],
    "subject_code": ["subject_code", "subject"],
    "grade": ["grade", "class", "year"],
    "ref_code": ["ref_code", "ref", "code", "outcome_code"],
    "statement": ["statement", "outcome", "learning_outcome", "text", "description"],
    "cognitive_level": ["cognitive_level", "bloom", "bloom_level", "level"],
}

REF_LINE = re.compile(r"^\s*([A-Z]{2,8}(?:[.\-][A-Za-z0-9]+){2,})\s*[:\-–]?\s+(.{12,})$")


@dataclass
class OutcomeRow:
    framework_code: str
    subject_code: str
    grade: str
    ref_code: str
    statement: str
    cognitive_level: str | None = None


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    lower = {c: c.strip().lower().replace(" ", "_") for c in df.columns}
    df = df.rename(columns=lower)
    mapping = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for a in aliases:
            if a in df.columns:
                mapping[a] = canonical
                break
    return df.rename(columns=mapping)


def parse_csv(data: bytes, defaults: dict | None = None) -> list[OutcomeRow]:
    df = _normalise_columns(pd.read_csv(io.BytesIO(data), dtype=str).fillna(""))
    return _rows_from_df(df, defaults or {})


def parse_xlsx(data: bytes, defaults: dict | None = None) -> list[OutcomeRow]:
    df = _normalise_columns(pd.read_excel(io.BytesIO(data), dtype=str).fillna(""))
    return _rows_from_df(df, defaults or {})


def _rows_from_df(df: pd.DataFrame, defaults: dict) -> list[OutcomeRow]:
    rows: list[OutcomeRow] = []
    for _, r in df.iterrows():
        ref = str(r.get("ref_code", "")).strip()
        stmt = str(r.get("statement", "")).strip()
        if not ref or not stmt:
            continue
        rows.append(OutcomeRow(
            framework_code=str(r.get("framework_code") or defaults.get("framework_code", "")).strip(),
            subject_code=str(r.get("subject_code") or defaults.get("subject_code", "")).strip(),
            grade=str(r.get("grade") or defaults.get("grade", "")).strip(),
            ref_code=ref,
            statement=stmt,
            cognitive_level=(str(r.get("cognitive_level") or "").strip().lower() or None),
        ))
    return rows


def parse_pdf(data: bytes, defaults: dict) -> list[OutcomeRow]:
    """Extracts lines shaped like `<REF.CODE>  <statement>` from a framework PDF."""
    import pdfplumber

    rows: list[OutcomeRow] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            for line in (page.extract_text() or "").splitlines():
                m = REF_LINE.match(line)
                if m:
                    rows.append(OutcomeRow(
                        framework_code=defaults["framework_code"], subject_code=defaults["subject_code"],
                        grade=defaults.get("grade", ""), ref_code=m.group(1), statement=m.group(2).strip(),
                    ))
    return rows


def import_outcomes(db: Client, school_id: str, rows: list[OutcomeRow], source_document: str) -> dict:
    frameworks = {f["code"]: f["id"] for f in db.table("frameworks").select("id, code").execute().data}
    subjects = {s["code"]: s["id"] for s in db.table("subjects").select("id, code").eq("school_id", school_id).execute().data}
    linked = {sf["framework_id"] for sf in db.table("school_frameworks").select("framework_id").eq("school_id", school_id).execute().data}

    payload, skipped = [], 0
    grades_by_fw: dict[str, set[str]] = {}
    for r in rows:
        fw = frameworks.get(r.framework_code)
        if not fw:
            skipped += 1
            continue
        if r.subject_code and r.subject_code not in subjects:
            created = db.table("subjects").insert({"school_id": school_id, "code": r.subject_code, "name": r.subject_code.title()}).execute().data[0]
            subjects[r.subject_code] = created["id"]
        grades_by_fw.setdefault(fw, set()).add(r.grade)
        payload.append({
            "school_id": school_id, "framework_id": fw, "subject_id": subjects.get(r.subject_code),
            "grade": r.grade, "ref_code": r.ref_code, "statement": r.statement,
            "cognitive_level": r.cognitive_level, "source_document": source_document,
        })

    for fw, grades in grades_by_fw.items():
        if fw not in linked:
            db.table("school_frameworks").insert({"school_id": school_id, "framework_id": fw, "grades": sorted(grades)}).execute()
            linked.add(fw)

    upserted = 0
    for i in range(0, len(payload), 200):
        chunk = payload[i:i + 200]
        db.table("learning_outcomes").upsert(chunk, on_conflict="school_id,framework_id,ref_code").execute()
        upserted += len(chunk)
    return {"upserted": upserted, "skipped": skipped, "frameworks": len(grades_by_fw)}
