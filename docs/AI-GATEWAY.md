# AI Gateway (Phase 0)

`worker/app/gateway.py` is the only path feature code uses to call a model.
Rule 16 (provider-agnostic) and rule 7 (no PII leaves the system boundary)
are both enforced here once, not per feature.

## Provider abstraction and fallback (`worker/app/providers.py`)

Fixed fallback order per the pinned stack: **gemini → groq → ollama**, with
whichever provider `AI_PROVIDER` names moved to the front of that order.
`AI_PROVIDER=ollama` locally means Ollama is tried first (and, having no
credential requirement, is always a usable last resort) -- this is what lets
local dev run fully offline (Section 4) without ever touching a rate limit.

A provider with no credentials configured (`GEMINI_API_KEY`/`GROQ_API_KEY`
blank) is **skipped**, not attempted. A configured provider that errors
(network failure, timeout, non-2xx) is caught (`ProviderError`) and the chain
moves on to the next one. Swapping the primary provider is the one
`AI_PROVIDER` env value (rule 16); no feature code changes.

Verified locally end to end against Ollama (`llama3.1:8b`) -- see
`worker/tests/test_gateway.py`, marked `@pytest.mark.requires_ollama` and
excluded from CI (a hosted runner can't reasonably pull a multi-GB model on
every push; see `PROGRESS.md` for the local run's output).

## Redaction (`worker/app/redact.py`)

**Context-aware known-value substitution, not general free-text PII
detection.** A generation request is always tied to specific `student_id`s /
`guardian_id`s (the caller supplies them), so their exact `full_name`,
`admission_no`, `dob`, `phone` and `email` are looked up from the database and
replaced with stable placeholders (`[STUDENT_1]`, `[GUARDIAN_1]`, ...) in both
the system and user prompt, before either is sent to any provider. Values are
replaced longest-first so a short value (e.g. a first name) can't shadow a
longer one that contains it.

Placeholders are re-substituted in the model's output -- with the entity's
**name**, since that's what belongs in generated prose. Admission number, DOB,
phone and email are redacted from the input and never re-injected into
output; a model has no reason to reproduce them.

`redaction_count` (how many spans were replaced) is written to
`generation_log`; the raw prompt is **never** stored, only its sha256 hash.

Verified against all 50 seeded students (`worker/tests/test_redact.py`, runs
in CI): for a prompt built the way a real SAARTHI parent-message generator
would build one, none of the student's or their guardian's name, admission
number, DOB, phone or email survive redaction, and re-substitution correctly
restores the student's name for the final output.

## Schema validation and retry (rule 15)

Every `prompt_templates` row declares a JSON Schema (`output_schema`). A
provider's response is parsed and validated with `jsonschema`; on failure, the
**same provider** is retried once (not the next provider in the fallback
chain -- a schema failure is the model not following instructions, not a
connectivity problem). If the retry also fails validation, `generate()`
raises `SchemaValidationFailedError` and writes `validation_result='invalid'`
to `generation_log`; invalid output is never returned to a caller.
`validation_result` is `'valid'` (first attempt), `'retried_valid'`, or
`'invalid'`.

## `generation_log`

One row per call: `template_key`/`template_version`, `provider`, `model`,
`redacted_prompt_hash`, `redaction_count`, token counts, `latency_ms`,
`output`, `validation_result`, and (when applicable) `artifact_type`/
`artifact_id`. RLS-scoped per tenant like every other table.

## What Phase 0 seeds for testing

`prompt_templates` has one row, `demo.greeting.v1` -- a smoke-test template
("write an encouraging note about {topic}"), not a real SAARTHI/PRASHNA
template. Real templates (item generation, descriptors, lesson plans, ...)
arrive with their respective phases.


## Phase 6 notes

- **Providers in production**: `AI_PROVIDER=gemini` (Gemini Flash), then Groq,
  then Ollama; unconfigured providers are skipped, never attempted. The
  leadership report (`/leadership`) shows the provider mix per tenant.
- **Streaming**: SAARTHI's `/saarthi/generate/stream` emits stage events
  (redacting → generating → validating → guardrails) over SSE via
  `web/app/api/saarthi/generate/route.ts`; the final artifact is still written
  only after schema validation and guardrails pass.
- **Guardrails** (post-validation): parent-facing and descriptor text is
  scanned for comparative, diagnostic, predictive and personality language in
  English and Hindi; a hit fails the generation loudly (`GuardrailError`), no
  silent rewrite.
- **What is logged**: `template_key`, version, provider, model, prompt
  **hash**, redaction count, tokens, latency, validation result. Never the
  prompt, never the redaction map.
- **Time-saved estimates** (`web/lib/leadership.ts`) are stated per artifact
  type and shown on the page and in the PDF; they are assumptions, not
  measurements.
- **Retry carries the errors**: the single schema-validation retry (rule 15) now
  appends the validator's field-level errors to the user prompt so the model
  corrects the exact fields. The errors quote only the model's own redacted
  output; the logged prompt hash is that of the original prompt.
- **Script check**: when a template asks for Hindi (`language_name` starts with
  "Hindi"), output with no Devanagari characters is treated as a validation
  failure and goes through the same single retry; a second miss fails loudly.
