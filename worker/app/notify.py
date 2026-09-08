"""
Notification delivery. pg_cron enqueues rows into notification_queue (HOD
digests, descriptor reminders); this flushes them. Resend in production
(RESEND_API_KEY set), plain SMTP to Mailpit locally. Bodies never contain
student names: the enqueue functions only count and link.
"""

import smtplib
from email.message import EmailMessage

import httpx
from supabase import Client

from .config import Settings, get_settings


def _send(settings: Settings, to: str, subject: str, text: str) -> None:
    if settings.resend_api_key:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.mail_from, "to": [to], "subject": subject, "text": text},
            timeout=20,
        )
        r.raise_for_status()
        return
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.mail_from, to, subject
    msg.set_content(text)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.send_message(msg)


def flush(db: Client, limit: int = 200, settings: Settings | None = None) -> dict:
    settings = settings or get_settings()
    rows = db.table("notification_queue").select("*").eq("status", "pending").order("id").limit(limit).execute().data
    sent = failed = 0
    for row in rows:
        try:
            _send(settings, row["to_email"], row["subject"], row["body_text"] + f"\n\n{settings.web_url}")
            db.table("notification_queue").update({"status": "sent", "sent_at": "now()"}).eq("id", row["id"]).execute()
            sent += 1
        except Exception as exc:  # noqa: BLE001 -- record and keep flushing
            db.table("notification_queue").update({"status": "failed", "error": str(exc)[:500]}).eq("id", row["id"]).execute()
            failed += 1
    return {"sent": sent, "failed": failed, "transport": "resend" if settings.resend_api_key else "smtp"}


def enqueue_now(db: Client) -> dict:
    """Runs the pg_cron enqueue functions immediately (demo / test hook)."""
    return {
        "hod_digests": db.rpc("enqueue_hod_digests").execute().data,
        "descriptor_reminders": db.rpc("enqueue_descriptor_reminders").execute().data,
    }
