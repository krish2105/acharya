-- 0004_demo_prompt_template.sql
-- One demo prompt template, used only to exercise the AI gateway end to end
-- in Phase 0 (schema validation, redaction, provider fallback, generation_log
-- writes) ahead of any real feature templates (Phase 2/3 add those).

insert into prompt_templates (key, version, system_prompt, user_template, output_schema, notes) values (
  'demo.greeting.v1',
  1,
  'You are a helpful assistant for a school. Respond with strict JSON only, matching the given schema exactly. No prose outside the JSON object.',
  'Write a one-sentence, encouraging note for a student about this topic: {topic}. Respond as JSON: {{"note": "<the sentence>"}}',
  '{"type":"object","properties":{"note":{"type":"string"}},"required":["note"],"additionalProperties":false}'::jsonb,
  'Phase 0 gateway smoke-test template. Not a real SAARTHI/PRASHNA template.'
);
