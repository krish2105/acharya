"""WeasyPrint rendering + private-bucket upload. Every PDF path is <school_id>/... so
storage RLS can scope reads by tenant."""

from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from supabase import Client

TEMPLATES = Path(__file__).resolve().parent.parent / "templates"

_env = Environment(loader=FileSystemLoader(str(TEMPLATES)), autoescape=select_autoescape(["html"]))
_env.globals["now"] = lambda: datetime.now(timezone.utc).strftime("%d %b %Y")


def render_pdf(template: str, context: dict) -> bytes:
    from weasyprint import HTML

    html = _env.get_template(template).render(**context)
    return HTML(string=html, base_url=str(TEMPLATES)).write_pdf()


def upload_pdf(db: Client, bucket: str, school_id: str, filename: str, data: bytes) -> str:
    path = f"{school_id}/{filename}"
    db.storage.from_(bucket).upload(path, data, {"content-type": "application/pdf", "upsert": "true"})
    return path
