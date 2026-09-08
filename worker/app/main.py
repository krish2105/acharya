from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi.errors import RateLimitExceeded

from .align import propose_alignments
from .db import get_service_client
from .embed import embed_concepts, embed_outcomes
from .gateway import GatewayError
from .importer import import_outcomes, parse_csv, parse_pdf, parse_xlsx
from .items import generate_items
from .papers import assemble_paper, create_improvement_paper, import_marks, render_paper_pdfs
from .security import limiter, require_worker_token
from .setu import build_transition_report

app = FastAPI(title="ACHARYA worker")
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _rate_limited(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "rate limit exceeded for this school"})


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# SETU
# ---------------------------------------------------------------------------

@app.post("/setu/import", dependencies=[Depends(require_worker_token)])
@limiter.limit("20/minute")
async def setu_import(
    request: Request,
    school_id: str = Form(...),
    source_document: str = Form(...),
    framework_code: str = Form(default=""),
    subject_code: str = Form(default=""),
    grade: str = Form(default=""),
    file: UploadFile = File(...),
):
    data = await file.read()
    defaults = {"framework_code": framework_code, "subject_code": subject_code, "grade": grade}
    name = (file.filename or "").lower()
    if name.endswith(".pdf"):
        if not framework_code or not subject_code:
            raise HTTPException(400, "PDF import needs framework_code and subject_code")
        rows = parse_pdf(data, defaults)
    elif name.endswith(".xlsx"):
        rows = parse_xlsx(data, defaults)
    else:
        rows = parse_csv(data, defaults)
    if not rows:
        raise HTTPException(422, "no outcomes found in file")
    db = get_service_client()
    result = import_outcomes(db, school_id, rows, source_document)
    result["embedded"] = embed_outcomes(db, school_id)
    return result


class EmbedRequest(BaseModel):
    school_id: str


@app.post("/setu/embed", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def setu_embed(request: Request, body: EmbedRequest):
    db = get_service_client()
    return {"outcomes": embed_outcomes(db, body.school_id), "concepts": embed_concepts(db, body.school_id)}


class AlignRequest(BaseModel):
    school_id: str
    outcome_ids: list[str] | None = None
    use_llm: bool = True


@app.post("/setu/align", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def setu_align(request: Request, body: AlignRequest):
    db = get_service_client()
    embed_concepts(db, body.school_id)
    embed_outcomes(db, body.school_id)
    return propose_alignments(db, body.school_id, body.outcome_ids, use_llm=body.use_llm)


class TransitionRequest(BaseModel):
    school_id: str
    student_id: str
    to_framework_code: str
    target_grade: str


@app.post("/setu/transition", dependencies=[Depends(require_worker_token)])
@limiter.limit("30/minute")
def setu_transition(request: Request, body: TransitionRequest):
    db = get_service_client()
    try:
        result = build_transition_report(db, body.school_id, body.student_id, body.to_framework_code, body.target_grade)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return result["report"]


# ---------------------------------------------------------------------------
# PRASHNA
# ---------------------------------------------------------------------------

class GenerateItemsRequest(BaseModel):
    school_id: str
    actor_id: str | None = None
    subject_id: str
    grade: str
    framework_id: str
    outcome_ids: list[str]
    item_type: str
    count: int = 5
    bloom: str = "apply"
    marks: float | None = None
    chapter_text: str | None = None


@app.post("/prashna/generate", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def prashna_generate(request: Request, body: GenerateItemsRequest):
    if not 1 <= body.count <= 30:
        raise HTTPException(400, "count must be 1-30")
    db = get_service_client()
    try:
        return generate_items(
            db, body.school_id, body.actor_id, subject_id=body.subject_id, grade=body.grade, framework_id=body.framework_id,
            outcome_ids=body.outcome_ids, item_type=body.item_type, count=body.count, bloom=body.bloom, marks=body.marks,
            chapter_text=body.chapter_text,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except GatewayError as e:
        raise HTTPException(502, f"generation failed: {e}")


class AssembleRequest(BaseModel):
    school_id: str
    actor_id: str | None = None
    blueprint_id: str
    section_id: str | None = None
    title: str
    exam_kind: str = "unit_test"
    scheduled_on: str | None = None


@app.post("/prashna/assemble", dependencies=[Depends(require_worker_token)])
@limiter.limit("20/minute")
def prashna_assemble(request: Request, body: AssembleRequest):
    db = get_service_client()
    return assemble_paper(db, body.school_id, blueprint_id=body.blueprint_id, section_id=body.section_id, title=body.title,
                          exam_kind=body.exam_kind, actor_id=body.actor_id, scheduled_on=body.scheduled_on)


class ImprovementRequest(BaseModel):
    school_id: str
    actor_id: str | None = None
    main_paper_id: str
    scheduled_on: str | None = None


@app.post("/prashna/improvement", dependencies=[Depends(require_worker_token)])
@limiter.limit("20/minute")
def prashna_improvement(request: Request, body: ImprovementRequest):
    db = get_service_client()
    return create_improvement_paper(db, body.school_id, body.main_paper_id, body.actor_id, body.scheduled_on)


class PaperPdfRequest(BaseModel):
    school_id: str
    paper_id: str


@app.post("/prashna/pdf", dependencies=[Depends(require_worker_token)])
@limiter.limit("20/minute")
def prashna_pdf(request: Request, body: PaperPdfRequest):
    db = get_service_client()
    return render_paper_pdfs(db, body.school_id, body.paper_id)


@app.post("/prashna/marks", dependencies=[Depends(require_worker_token)])
@limiter.limit("20/minute")
async def prashna_marks(request: Request, school_id: str = Form(...), paper_id: str = Form(...), file: UploadFile = File(...)):
    db = get_service_client()
    result = import_marks(db, school_id, paper_id, await file.read())
    result["calibrated"] = db.rpc("run_item_calibration", {"p_school_id": school_id}).execute().data
    return result


class CalibrateRequest(BaseModel):
    school_id: str


@app.post("/prashna/calibrate", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def prashna_calibrate(request: Request, body: CalibrateRequest):
    db = get_service_client()
    return {"items": db.rpc("run_item_calibration", {"p_school_id": body.school_id}).execute().data}


# ---------------------------------------------------------------------------
# SAARTHI
# ---------------------------------------------------------------------------
import json as _json

from fastapi.responses import StreamingResponse

from .saarthi import GuardrailError, build_remediation_set, generate_artifact, generate_artifact_events, render_artifact_pdf


class ArtifactRequest(BaseModel):
    school_id: str
    actor_id: str | None = None
    kind: str
    outcome_ids: list[str] | None = None
    unit_id: str | None = None
    section_id: str | None = None
    student_id: str | None = None
    language: str = "en"
    notes: str = ""
    periods: int = 3
    period_minutes: int = 40


@app.post("/saarthi/generate", dependencies=[Depends(require_worker_token)])
@limiter.limit("20/minute")
def saarthi_generate(request: Request, body: ArtifactRequest):
    db = get_service_client()
    try:
        return generate_artifact(db, body.school_id, body.actor_id, body.kind, outcome_ids=body.outcome_ids, unit_id=body.unit_id,
                                 section_id=body.section_id, student_id=body.student_id, language=body.language, notes=body.notes,
                                 periods=body.periods, period_minutes=body.period_minutes)
    except GuardrailError as e:
        raise HTTPException(422, f"rejected by post-validation: {e.violations}")
    except ValueError as e:
        raise HTTPException(400, str(e))
    except GatewayError as e:
        raise HTTPException(502, f"generation failed: {e}")


@app.post("/saarthi/generate/stream", dependencies=[Depends(require_worker_token)])
@limiter.limit("20/minute")
def saarthi_generate_stream(request: Request, body: ArtifactRequest):
    db = get_service_client()

    def events():
        yield f"data: {_json.dumps({'stage': 'queued', 'index': 0, 'total': 6})}\n\n"
        try:
            for ev in generate_artifact_events(db, body.school_id, body.actor_id, body.kind, outcome_ids=body.outcome_ids, unit_id=body.unit_id,
                                               section_id=body.section_id, student_id=body.student_id, language=body.language, notes=body.notes,
                                               periods=body.periods, period_minutes=body.period_minutes):
                yield f"data: {_json.dumps(ev)}\n\n"
        except GatewayError as e:
            yield f"data: {_json.dumps({'error': f'generation failed: {e}'})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class RemediationRequest(BaseModel):
    school_id: str
    actor_id: str | None = None
    section_id: str
    subject_id: str | None = None
    weak_outcome_ids: list[str] | None = None
    generate_for_gaps: bool = True
    language: str = "en"


@app.post("/saarthi/remediation", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def saarthi_remediation(request: Request, body: RemediationRequest):
    db = get_service_client()
    try:
        return build_remediation_set(db, body.school_id, body.actor_id, section_id=body.section_id, subject_id=body.subject_id,
                                     weak_outcome_ids=body.weak_outcome_ids, generate_for_gaps=body.generate_for_gaps, language=body.language)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except GatewayError as e:
        raise HTTPException(502, f"generation failed: {e}")


class ArtifactPdfRequest(BaseModel):
    school_id: str
    artifact_id: str


@app.post("/saarthi/pdf", dependencies=[Depends(require_worker_token)])
@limiter.limit("30/minute")
def saarthi_pdf(request: Request, body: ArtifactPdfRequest):
    db = get_service_client()
    return {"file_path": render_artifact_pdf(db, body.school_id, body.artifact_id)["file_path"]}


# ---------------------------------------------------------------------------
# DARPAN
# ---------------------------------------------------------------------------
from .darpan import draft_descriptor, render_hpc_report


class DescriptorRequest(BaseModel):
    school_id: str
    actor_id: str | None = None
    student_id: str
    term: str
    domain: str
    language: str = "en"


@app.post("/darpan/descriptor", dependencies=[Depends(require_worker_token)])
@limiter.limit("30/minute")
def darpan_descriptor(request: Request, body: DescriptorRequest):
    db = get_service_client()
    try:
        return draft_descriptor(db, body.school_id, body.actor_id, student_id=body.student_id, term=body.term, domain=body.domain, language=body.language)
    except GuardrailError as e:
        raise HTTPException(422, f"rejected by post-validation: {e.violations}")
    except ValueError as e:
        raise HTTPException(400, str(e))
    except GatewayError as e:
        raise HTTPException(502, f"generation failed: {e}")


class ReportRequest(BaseModel):
    school_id: str
    actor_id: str | None = None
    student_id: str
    term: str


@app.post("/darpan/report", dependencies=[Depends(require_worker_token)])
@limiter.limit("30/minute")
def darpan_report(request: Request, body: ReportRequest):
    db = get_service_client()
    try:
        r = render_hpc_report(db, body.school_id, body.student_id, body.term, body.actor_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # DB gate (unapproved descriptors) surfaces as a postgrest error
        msg = str(e)
        if "blocked" in msg:
            raise HTTPException(409, msg)
        raise
    return {"report_id": r["report_id"], "file_path": r["file_path"], "stage": r["stage"]}


# ---------------------------------------------------------------------------
# UDAY
# ---------------------------------------------------------------------------
from .uday import render_evidence_pack


class EvidencePackRequest(BaseModel):
    school_id: str
    grade: str
    academic_year: str = "2026-27"


@app.post("/uday/evidence-pack", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def uday_evidence_pack(request: Request, body: EvidencePackRequest):
    db = get_service_client()
    r = render_evidence_pack(db, body.school_id, body.grade, body.academic_year)
    return {"file_path": r["file_path"], "sections": r["sections"], "units": r["units"]}


# ---------------------------------------------------------------------------
# Phase 6: notifications, DPDP, substitute pack
# ---------------------------------------------------------------------------
from .dpdp import execute_erasure, export_student  # noqa: E402
from .notify import enqueue_now, flush  # noqa: E402
from .saarthi import render_substitute_pack  # noqa: E402


@app.post("/notify/flush", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def notify_flush(request: Request):
    db = get_service_client()
    return flush(db)


@app.post("/notify/enqueue-now", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def notify_enqueue_now(request: Request):
    return enqueue_now(get_service_client())


class DpdpExportRequest(BaseModel):
    school_id: str
    student_id: str


@app.post("/dpdp/export", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def dpdp_export(request: Request, body: DpdpExportRequest):
    db = get_service_client()
    out = export_student(db, body.school_id, body.student_id)
    out.pop("document", None)
    return out


class DpdpEraseRequest(BaseModel):
    school_id: str
    request_id: str


@app.post("/dpdp/erase", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def dpdp_erase(request: Request, body: DpdpEraseRequest):
    return execute_erasure(get_service_client(), body.request_id)


class SubstitutePackRequest(BaseModel):
    school_id: str
    teacher_id: str
    weekday: int


@app.post("/saarthi/substitute-pack", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def saarthi_substitute_pack(request: Request, body: SubstitutePackRequest):
    return render_substitute_pack(get_service_client(), body.school_id, body.teacher_id, body.weekday)


from .leadership import render_leadership_report  # noqa: E402


class LeadershipReportRequest(BaseModel):
    school_id: str
    summary: dict


@app.post("/leadership/report", dependencies=[Depends(require_worker_token)])
@limiter.limit("10/minute")
def leadership_report(request: Request, body: LeadershipReportRequest):
    return render_leadership_report(get_service_client(), body.school_id, body.summary)
