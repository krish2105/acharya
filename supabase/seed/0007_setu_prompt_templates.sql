-- 0007_setu_prompt_templates.sql
-- Alignment relation labelling for the 0.65-0.82 similarity band (Section 6.3
-- alignment pipeline, step 4). Outcome-only prompt: no student data exists here.

insert into prompt_templates (key, version, system_prompt, user_template, output_schema, notes) values (
  'align.relation.v1',
  1,
  'You are a curriculum specialist mapping learning outcomes from school boards (CBSE, IB, Cambridge, AP) onto a canonical concept graph. Judge only the academic content. Respond with strict JSON matching the schema; no prose outside the JSON object.',
  'Learning outcome: "{outcome_statement}"
Candidate concept: "{concept_title}" — {concept_description}

Decide the relation between the outcome and the concept:
- "equivalent": the outcome is essentially about this concept
- "partial": the outcome covers part of this concept or this concept is part of the outcome
- "prerequisite": the concept must be learned before this outcome
- "extends": the outcome goes beyond this concept
- "unrelated": no meaningful academic relation

Respond as JSON: {{"relation": "<one of equivalent|partial|prerequisite|extends|unrelated>", "justification": "<one sentence>"}}',
  '{"type":"object","properties":{"relation":{"type":"string","enum":["equivalent","partial","prerequisite","extends","unrelated"]},"justification":{"type":"string"}},"required":["relation","justification"],"additionalProperties":false}'::jsonb,
  'SETU alignment engine, LLM-assisted band. Never confirms; a human does.'
);
