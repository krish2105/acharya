from supabase import Client, create_client

from .config import get_settings


def get_service_client() -> Client:
    """Service-role client: bypasses RLS. Trusted server-side code only."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
