import pytest
from dotenv import load_dotenv

from app.config import get_settings
from app.db import get_service_client

load_dotenv()

KALANJALI_SCHOOL_ID = "a0000000-0000-0000-0000-000000000001"


@pytest.fixture(scope="session")
def db():
    return get_service_client()


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    # get_settings() is lru_cache'd; tests that monkeypatch env vars need a
    # fresh read each time.
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
