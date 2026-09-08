import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    ai_provider: str  # 'gemini' | 'groq' | 'ollama' -- the preferred/primary provider

    ollama_base_url: str
    ollama_model: str

    gemini_api_key: str
    gemini_model: str
    gemini_base_url: str

    groq_api_key: str
    groq_model: str
    groq_base_url: str

    supabase_url: str
    supabase_service_role_key: str
    worker_token: str
    resend_api_key: str
    smtp_host: str
    smtp_port: int
    mail_from: str
    web_url: str


@lru_cache
def get_settings() -> Settings:
    load_dotenv()
    return Settings(
        ai_provider=os.environ.get("AI_PROVIDER", "ollama"),
        ollama_base_url=os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
        ollama_model=os.environ.get("OLLAMA_MODEL", "llama3.1:8b"),
        gemini_api_key=os.environ.get("GEMINI_API_KEY", ""),
        gemini_model=os.environ.get("GEMINI_MODEL", "gemini-1.5-flash"),
        gemini_base_url=os.environ.get(
            "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"
        ),
        groq_api_key=os.environ.get("GROQ_API_KEY", ""),
        groq_model=os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant"),
        groq_base_url=os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
        supabase_url=os.environ.get("SUPABASE_URL", ""),
        supabase_service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        worker_token=os.environ.get("WORKER_TOKEN", ""),
        resend_api_key=os.environ.get("RESEND_API_KEY", ""),
        smtp_host=os.environ.get("SMTP_HOST", "127.0.0.1"),
        smtp_port=int(os.environ.get("SMTP_PORT", "54345")),
        mail_from=os.environ.get("MAIL_FROM", "ACHARYA <noreply@acharya.demo>"),
        web_url=os.environ.get("WEB_URL", "http://localhost:3000"),
    )
