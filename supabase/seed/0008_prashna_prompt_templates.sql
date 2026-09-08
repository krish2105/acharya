-- 0008_prashna_prompt_templates.sql
-- Eight item-type templates, each with a strict JSON schema (Section 8, Phase 2
-- task 2). No student data ever enters these prompts.

create temp table _item_schema (schema jsonb);
insert into _item_schema values ('{
  "type":"object",
  "properties":{
    "items":{
      "type":"array","minItems":1,
      "items":{
        "type":"object",
        "properties":{
          "stem":{"type":"string","minLength":10},
          "stimulus":{"type":["string","null"]},
          "options":{"type":["array","null"],"items":{"type":"object","properties":{"label":{"type":"string"},"text":{"type":"string"}},"required":["label","text"]}},
          "parts":{"type":["array","null"],"items":{"type":"object","properties":{"text":{"type":"string"},"marks":{"type":"number"}},"required":["text","marks"]}},
          "answer_key":{"type":"object"},
          "marking_scheme":{"type":"string"},
          "marks":{"type":"number","minimum":1},
          "cognitive_level":{"type":"string","enum":["remember","understand","apply","analyse","evaluate","create"]},
          "difficulty_intended":{"type":"string","enum":["easy","medium","hard"]}
        },
        "required":["stem","answer_key","marking_scheme","marks","cognitive_level","difficulty_intended"],
        "additionalProperties":true
      }
    }
  },
  "required":["items"],
  "additionalProperties":false
}'::jsonb);

create temp table _tpl (key text, guidance text);
insert into _tpl values
('item.mcq.v1', 'Multiple-choice questions. Each item: a clear stem, exactly 4 options labelled A-D (one unambiguously correct, three plausible distractors targeting common misconceptions), answer_key {{"correct":"<label>"}}, marks 1. Prefer application MCQs (a scenario, data or diagram description) over recall.'),
('item.assertion_reason.v1', 'Assertion-Reason items. stem = "Assertion (A): ... Reason (R): ...". options = the 4 standard choices (A: both true, R explains A; B: both true, R does not explain A; C: A true, R false; D: A false, R true). answer_key {{"correct":"<label>"}}, marks 1.'),
('item.case_based.v1', 'Case-based items. stimulus = a 120-180 word original case or scenario (never copied from any textbook). stem = 3 sub-questions numbered (i)-(iii) that require applying the outcome to the case. parts = one entry per sub-question with marks. marks = total (4). answer_key {{"parts":[{{"answer":"...", "marks":n}}, ...]}}.'),
('item.source_based.v1', 'Source-based items. stimulus = an original short source (data table described in prose, an extract, a graph description). stem = 3 sub-questions that require interpreting the source. parts with marks, total marks 4. answer_key {{"parts":[...]}}.'),
('item.short_answer.v1', 'Short-answer questions (2 or 3 marks as requested). stem is a single question expecting a 3-5 line answer. answer_key {{"answer":"<model answer>", "points":["...","..."]}} with one point per mark. marking_scheme explains mark allocation.'),
('item.long_answer.v1', 'Long-answer questions (5 marks). stem may have 2 linked parts. answer_key {{"answer":"<model answer>", "points":[...]}} with five awardable points. marking_scheme explains allocation and partial credit.'),
('item.numerical.v1', 'Numerical problems (2 or 3 marks) with realistic values and units. stem gives all data. answer_key {{"answer":"<final value with unit>", "working":"<key steps>"}}. marking_scheme awards marks for method and final answer.'),
('item.diagram.v1', 'Diagram-based questions (3 marks). stem asks the student to draw and label, or to interpret a described diagram. answer_key {{"answer":"<expected labels/features>", "points":[...]}}.'),
('item.competency_cluster.v1', 'Competency clusters: one stimulus (an original scenario, 100-150 words) followed by 3 progressively harder sub-questions moving from understand to apply to analyse/evaluate. parts with marks summing to 4. answer_key {{"parts":[...]}}.');

insert into prompt_templates (key, version, system_prompt, user_template, output_schema, notes)
select t.key, 1,
  'You are an experienced question setter for Indian and international school boards (CBSE, IB, Cambridge, AP). Write original, competency-based assessment items strictly aligned to the given learning outcome(s). Never reproduce copyrighted textbook text. Never reference any named student or school. Respond with strict JSON only, matching the schema; no prose outside the JSON object.',
  'Framework: {framework}. Subject: {subject}. Grade: {grade}.
Learning outcome(s) the items MUST assess:
{outcome_block}

Item type: {item_type}. Bloom level to target: {bloom}. Marks per item: {marks}. Number of items: {count}.
{chapter_block}

Type guidance: ' || t.guidance || '

Respond as JSON: {{"items":[{{"stem":"...","stimulus":null,"options":null,"parts":null,"answer_key":{{}},"marking_scheme":"...","marks":{marks},"cognitive_level":"{bloom}","difficulty_intended":"medium"}}]}}',
  s.schema,
  'PRASHNA item generation. Output is validated, lands as draft, needs HOD approval.'
from _tpl t cross join _item_schema s;

drop table _tpl;
drop table _item_schema;
