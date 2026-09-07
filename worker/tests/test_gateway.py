import pytest

from app.config import get_settings
from app.gateway import AllProvidersUnavailableError, generate
from tests.conftest import KALANJALI_SCHOOL_ID


@pytest.mark.requires_ollama
def test_generate_succeeds_against_local_ollama(db, monkeypatch):
    """Phase 0 acceptance test: the gateway returns schema-valid output from
    the local Ollama model."""
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GROQ_API_KEY", "")

    result = generate(
        db,
        KALANJALI_SCHOOL_ID,
        "demo.greeting.v1",
        {"topic": "fractions"},
    )

    assert result.provider == "ollama"
    assert result.validation_result in ("valid", "retried_valid")
    assert isinstance(result.output, dict)
    assert isinstance(result.output.get("note"), str) and result.output["note"]

    logged = (
        db.table("generation_log")
        .select("*")
        .eq("id", result.generation_log_id)
        .single()
        .execute()
        .data
    )
    assert logged["provider"] == "ollama"
    assert logged["template_key"] == "demo.greeting.v1"
    assert logged["validation_result"] == result.validation_result
    # generation_log must never store the raw prompt -- only its hash.
    assert "prompt" not in logged or logged.get("prompt") is None
    assert len(logged["redacted_prompt_hash"]) == 64  # sha256 hex digest


@pytest.mark.requires_ollama
def test_generate_falls_back_to_ollama_when_primary_is_unreachable(db, monkeypatch):
    """Phase 0 acceptance test: the gateway falls back correctly when the
    primary provider is unreachable. Gemini is 'configured' (a key is set)
    but pointed at an unreachable address, so the gateway must actually
    attempt it, fail, and fall through groq (unconfigured, skipped) to
    ollama -- proving the fallthrough logic, not just provider selection.
    """
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key-for-fallback-test")
    monkeypatch.setenv("GEMINI_BASE_URL", "http://127.0.0.1:1")  # nothing listens here
    monkeypatch.setenv("GROQ_API_KEY", "")

    result = generate(
        db,
        KALANJALI_SCHOOL_ID,
        "demo.greeting.v1",
        {"topic": "long division"},
    )

    assert result.provider == "ollama"
    assert isinstance(result.output.get("note"), str) and result.output["note"]


def test_generate_raises_when_every_provider_is_unreachable(db, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GROQ_API_KEY", "")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://127.0.0.1:1")

    # Ollama has no API key requirement, so it's always "configured" -- but
    # unreachable here, so every provider fails and the call should raise.
    with pytest.raises(AllProvidersUnavailableError):
        generate(db, KALANJALI_SCHOOL_ID, "demo.greeting.v1", {"topic": "algebra"})
