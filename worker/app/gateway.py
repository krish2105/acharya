"""
The AI gateway (Section 6.2, Phase 0 task 6): loads a versioned prompt
template, redacts PII from the built prompt, calls the provider chain with
schema validation and one retry, and writes a `generation_log` row. This is
the only path feature code uses to call a model -- rule 16 (provider-
agnostic) and rule 7 (no PII leaves the system boundary) are both enforced
here, once, rather than per feature.
"""

import hashlib
import json
import time
from dataclasses import dataclass

import jsonschema
from supabase import Client

from .config import Settings, get_settings
from .providers import ProviderError, build_chain
from .redact import RedactedEntity, load_entities, redact, resubstitute


class GatewayError(Exception):
    pass


class TemplateNotFoundError(GatewayError):
    pass


class SchemaValidationFailedError(GatewayError):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__(f"output failed schema validation after retry: {errors}")


class AllProvidersUnavailableError(GatewayError):
    pass


@dataclass(frozen=True)
class GenerationResult:
    output: dict
    provider: str
    model: str
    validation_result: str  # 'valid' | 'retried_valid'
    redaction_count: int
    input_tokens: int | None
    output_tokens: int | None
    latency_ms: int
    generation_log_id: int


def _load_template(db: Client, key: str, version: int | None) -> dict:
    query = db.table("prompt_templates").select("*").eq("key", key).eq("is_active", True)
    if version is not None:
        query = query.eq("version", version)
    else:
        query = query.order("version", desc=True).limit(1)
    rows = query.execute().data
    if not rows:
        raise TemplateNotFoundError(f"no active prompt_templates row for key={key} version={version}")
    return rows[0]


def _strings(value) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [s for v in value.values() for s in _strings(v)]
    if isinstance(value, list):
        return [s for v in value for s in _strings(v)]
    return []


def _script_errors(parsed: dict, variables: dict) -> list[str]:
    """Templates that ask for Hindi (variables['language_name'] starts with 'Hindi')
    must come back in Devanagari; a schema cannot see that, so it is checked here
    and takes part in the same single retry."""
    if not str(variables.get("language_name", "")).startswith("Hindi"):
        return []
    text = " ".join(_strings(parsed))
    if any("\u0900" <= ch <= "\u097f" for ch in text):
        return []
    return ["language: the output must be written in Hindi using Devanagari script; every user-facing string value came back in another script"]


def _validate(output_text: str, schema: dict) -> tuple[dict | None, list[str]]:
    try:
        parsed = json.loads(output_text)
    except json.JSONDecodeError as e:
        return None, [f"invalid JSON: {e}"]

    validator = jsonschema.Draft7Validator(schema)
    errors = [f"{'.'.join(str(p) for p in err.path)}: {err.message}" for err in validator.iter_errors(parsed)]
    if errors:
        return None, errors
    return parsed, []


def generate(
    db: Client,
    school_id: str,
    template_key: str,
    variables: dict,
    *,
    template_version: int | None = None,
    student_ids: list[str] | None = None,
    guardian_ids: list[str] | None = None,
    actor_id: str | None = None,
    artifact_type: str | None = None,
    artifact_id: str | None = None,
    settings: Settings | None = None,
) -> GenerationResult:
    settings = settings or get_settings()
    template = _load_template(db, template_key, template_version)

    system_prompt = template["system_prompt"]
    user_prompt = template["user_template"].format(**variables)

    entities: list[RedactedEntity] = load_entities(
        db, school_id, student_ids or [], guardian_ids or []
    )
    redacted_system, count_sys = redact(system_prompt, entities)
    redacted_user, count_user = redact(user_prompt, entities)
    redaction_count = count_sys + count_user

    prompt_hash = hashlib.sha256((redacted_system + "\n" + redacted_user).encode()).hexdigest()

    chain = build_chain(settings)
    configured = [p for p in chain if p.is_configured()]
    if not configured:
        raise AllProvidersUnavailableError("no provider is configured (not even ollama)")

    last_error: Exception | None = None
    for provider in configured:
        start = time.monotonic()
        try:
            result = provider.complete(redacted_system, redacted_user)
        except ProviderError as e:
            last_error = e
            continue

        latency_ms = int((time.monotonic() - start) * 1000)

        parsed, errors = _validate(result.text, template["output_schema"])
        if parsed is not None:
            errors = _script_errors(parsed, variables)
        validation_result = "valid"
        if errors:
            # one retry against the same provider, per rule 15 -- telling the
            # model exactly which fields missed the schema. The errors quote only
            # its own (already redacted) output, so nothing new reaches the model.
            fix_note = (
                "\n\nYour previous reply did not match the required JSON schema. Problems:\n- "
                + "\n- ".join(e[:300] for e in errors[:12])
                + "\nReturn the complete JSON again with these fields corrected. Every field must have "
                "exactly the type the schema requires (a string field must be a plain string, not an "
                "object or list). Output JSON only."
            )
            try:
                retry_start = time.monotonic()
                result = provider.complete(redacted_system, redacted_user + fix_note)
                latency_ms = int((time.monotonic() - retry_start) * 1000)
            except ProviderError as e:
                last_error = e
                continue
            parsed, errors = _validate(result.text, template["output_schema"])
            if parsed is not None:
                errors = _script_errors(parsed, variables)
            validation_result = "retried_valid"

        if errors:
            _write_log(
                db, school_id, actor_id, template, result.provider, result.model,
                prompt_hash, redaction_count, None, None, latency_ms,
                None, "invalid", artifact_type, artifact_id,
            )
            raise SchemaValidationFailedError(errors)

        # re-substitute placeholders in any string field of the parsed output
        final_output = _resubstitute_json(parsed, entities)

        log_id = _write_log(
            db, school_id, actor_id, template, result.provider, result.model,
            prompt_hash, redaction_count, result.input_tokens, result.output_tokens,
            latency_ms, final_output, validation_result, artifact_type, artifact_id,
        )

        return GenerationResult(
            output=final_output,
            provider=result.provider,
            model=result.model,
            validation_result=validation_result,
            redaction_count=redaction_count,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            latency_ms=latency_ms,
            generation_log_id=log_id,
        )

    raise AllProvidersUnavailableError(f"every configured provider failed; last error: {last_error}")


def _resubstitute_json(value, entities: list[RedactedEntity]):
    if isinstance(value, str):
        return resubstitute(value, entities)
    if isinstance(value, list):
        return [_resubstitute_json(v, entities) for v in value]
    if isinstance(value, dict):
        return {k: _resubstitute_json(v, entities) for k, v in value.items()}
    return value


def _write_log(
    db: Client, school_id, actor_id, template, provider, model, prompt_hash,
    redaction_count, input_tokens, output_tokens, latency_ms, output,
    validation_result, artifact_type, artifact_id,
) -> int:
    row = (
        db.table("generation_log")
        .insert({
            "school_id": school_id,
            "actor_id": actor_id,
            "template_key": template["key"],
            "template_version": template["version"],
            "provider": provider,
            "model": model,
            "redacted_prompt_hash": prompt_hash,
            "redaction_count": redaction_count,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "latency_ms": latency_ms,
            "output": output,
            "validation_result": validation_result,
            "artifact_type": artifact_type,
            "artifact_id": artifact_id,
        })
        .execute()
    )
    return row.data[0]["id"]
