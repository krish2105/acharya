import hmac

from fastapi import Header, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import get_settings


def tenant_key(request: Request) -> str:
    # Per-tenant rate limiting: the web server forwards the caller's school_id.
    return request.headers.get("x-school-id") or get_remote_address(request)


limiter = Limiter(key_func=tenant_key, default_limits=["120/minute"])


def require_worker_token(x_worker_token: str | None = Header(default=None)) -> None:
    expected = get_settings().worker_token
    if not expected or not x_worker_token or not hmac.compare_digest(x_worker_token, expected):
        raise HTTPException(status_code=401, detail="invalid worker token")
