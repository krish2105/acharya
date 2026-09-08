"""Leadership PDF: AI usage and estimated time saved. The web app computes the
summary (web/lib/leadership.ts, single source of the assumptions) and sends it
here for rendering; nothing in it identifies a student."""

from supabase import Client

from .pdf import render_pdf, upload_pdf


def render_leadership_report(db: Client, school_id: str, summary: dict, upload: bool = True) -> dict:
    school = db.table("schools").select("name").eq("id", school_id).single().execute().data
    pdf = render_pdf("leadership_report.html", {"title": "AI usage & time saved", "school_name": school["name"], "s": summary})
    path = upload_pdf(db, "artifacts", school_id, "leadership/ai-usage-report.pdf", pdf) if upload else None
    return {"path": path, "bytes": len(pdf)}
