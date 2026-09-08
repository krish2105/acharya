-- 0010_saarthi_prompt_templates.sql
-- Seven SAARTHI generators (Section 6.5), each schema-validated. Prompts start
-- from outcomes/units, never a blank box. Parent messages carry hard
-- prohibitions on diagnostic or comparative language; the worker also
-- post-validates them.

create temp table _s (key text, sys text, usr text, schema jsonb, notes text);

insert into _s values
('saarthi.lesson_plan.v1',
 'You are an expert teacher-planner for Indian and international school boards. Produce practical, classroom-ready lesson plans aligned to the given learning outcomes, in {language_name}. Never name any real student or school. Respond with strict JSON only, matching the schema; no prose outside the JSON.',
 'Framework: {framework}. Subject: {subject}. Grade: {grade}. Unit: {unit_title}. Periods available: {periods} x {period_minutes} minutes.
Learning outcomes:
{outcome_block}
Teacher notes (optional): {notes}

Write a lesson plan with: 3-4 objectives (each tied to an outcome ref code), a hook, a sequence of 4-6 steps with minutes and what the teacher does / students do, 3 checks for understanding, differentiation for support/core/extension, a closure, and homework.
Respond as JSON: {{"title":"...","objectives":[{{"text":"...","outcome_ref":"..."}}],"hook":"...","sequence":[{{"step":"...","minutes":10,"teacher_does":"...","students_do":"..."}}],"checks_for_understanding":["..."],"differentiation":{{"support":"...","core":"...","extension":"..."}},"closure":"...","homework":"..."}}',
 '{"type":"object","properties":{"title":{"type":"string"},"objectives":{"type":"array","minItems":2,"items":{"type":"object","properties":{"text":{"type":"string"},"outcome_ref":{"type":"string"}},"required":["text"]}},"hook":{"type":"string"},"sequence":{"type":"array","minItems":3,"items":{"type":"object","properties":{"step":{"type":"string"},"minutes":{"type":"number"},"teacher_does":{"type":"string"},"students_do":{"type":"string"}},"required":["step","minutes"]}},"checks_for_understanding":{"type":"array","items":{"type":"string"}},"differentiation":{"type":"object","properties":{"support":{"type":"string"},"core":{"type":"string"},"extension":{"type":"string"}},"required":["support","core","extension"]},"closure":{"type":"string"},"homework":{"type":"string"}},"required":["title","objectives","hook","sequence","differentiation","closure"],"additionalProperties":true}',
 'Lesson plan for a unit.'),

('saarthi.worksheet.v1',
 'You are an expert teacher writing differentiated practice worksheets aligned to a learning outcome, in {language_name}. Produce the SAME outcome at three levels: support (scaffolded), core, extension (stretch). Never reference any real student. Respond with strict JSON only.',
 'Framework: {framework}. Subject: {subject}. Grade: {grade}.
Learning outcomes:
{outcome_block}
Teacher notes (optional): {notes}

Write a worksheet titled for the outcome with three levels. Each level: short instructions and 4-6 questions with marks. Then an answer key covering all levels.
Respond as JSON: {{"title":"...","levels":{{"support":{{"instructions":"...","questions":[{{"q":"...","marks":1}}]}},"core":{{"instructions":"...","questions":[{{"q":"...","marks":2}}]}},"extension":{{"instructions":"...","questions":[{{"q":"...","marks":3}}]}}}},"answer_key":[{{"level":"support","answers":["..."]}}]}}',
 '{"type":"object","properties":{"title":{"type":"string"},"levels":{"type":"object","properties":{"support":{"$ref":"#/$defs/level"},"core":{"$ref":"#/$defs/level"},"extension":{"$ref":"#/$defs/level"}},"required":["support","core","extension"]},"answer_key":{"type":"array","items":{"type":"object","properties":{"level":{"type":"string"},"answers":{"type":"array","items":{"type":"string"}}},"required":["level","answers"]}}},"required":["title","levels","answer_key"],"$defs":{"level":{"type":"object","properties":{"instructions":{"type":"string"},"questions":{"type":"array","minItems":3,"items":{"type":"object","properties":{"q":{"type":"string"},"marks":{"type":"number"}},"required":["q","marks"]}}},"required":["instructions","questions"]}},"additionalProperties":true}',
 'Differentiated worksheet: support / core / extension.'),

('saarthi.rubric.v1',
 'You are an assessment specialist writing analytic rubrics aligned to learning outcomes, in {language_name}. Descriptors must be observable and specific. Respond with strict JSON only.',
 'Framework: {framework}. Subject: {subject}. Grade: {grade}.
Learning outcomes:
{outcome_block}
Task description: {notes}

Write a rubric with 3-5 criteria; each criterion has 4 bands (Beginning, Developing, Proficient, Exemplary) with a descriptor and marks.
Respond as JSON: {{"title":"...","task":"...","criteria":[{{"name":"...","outcome_ref":"...","bands":[{{"level":"Beginning","descriptor":"...","marks":1}}]}}]}}',
 '{"type":"object","properties":{"title":{"type":"string"},"task":{"type":"string"},"criteria":{"type":"array","minItems":3,"items":{"type":"object","properties":{"name":{"type":"string"},"outcome_ref":{"type":"string"},"bands":{"type":"array","minItems":3,"items":{"type":"object","properties":{"level":{"type":"string"},"descriptor":{"type":"string"},"marks":{"type":"number"}},"required":["level","descriptor","marks"]}}},"required":["name","bands"]}}},"required":["title","task","criteria"],"additionalProperties":true}',
 'Rubric from an outcome and a task description.'),

('saarthi.parent_message.v1',
 'You draft short messages from a class teacher to a parent, in {language_name}. The message must be warm, specific and practical. HARD PROHIBITIONS: never diagnose or use clinical or psychological labels; never compare the child to other children, the class, or a rank; never predict future performance; never mention marks of other students. Refer to the child using the placeholder token exactly as given (e.g. [STUDENT_1]) and to the parent as [GUARDIAN_1]; do not invent names. Respond with strict JSON only.',
 'Subject: {subject}. Grade: {grade}. Learning outcome context:
{outcome_block}
Teacher notes about the child (already anonymised): {notes}

Write a message of 90-140 words with a clear subject line. Mention one specific strength, one specific next step for home, and an invitation to talk.
Respond as JSON: {{"subject":"...","message":"..."}}',
 '{"type":"object","properties":{"subject":{"type":"string"},"message":{"type":"string","minLength":40}},"required":["subject","message"],"additionalProperties":false}',
 'Parent message. Redaction round-trip: names replaced before the prompt, restored after.'),

('saarthi.activity.v1',
 'You design engaging classroom activities aligned to learning outcomes, in {language_name}. Prefer low-resource, plugged-or-unplugged options. Respond with strict JSON only.',
 'Framework: {framework}. Subject: {subject}. Grade: {grade}.
Learning outcomes:
{outcome_block}
Teacher notes (optional): {notes}

Write one activity: title, duration in minutes, materials, 4-7 numbered steps, and an assessment note (what evidence of the outcome to look for).
Respond as JSON: {{"title":"...","duration_minutes":30,"materials":["..."],"steps":["..."],"assessment_note":"..."}}',
 '{"type":"object","properties":{"title":{"type":"string"},"duration_minutes":{"type":"number"},"materials":{"type":"array","items":{"type":"string"}},"steps":{"type":"array","minItems":3,"items":{"type":"string"}},"assessment_note":{"type":"string"}},"required":["title","duration_minutes","steps","assessment_note"],"additionalProperties":true}',
 'Classroom activity.'),

('saarthi.remediation_set.v1',
 'You write short remediation practice for a learning outcome a class found difficult, in {language_name}. Each practice question has a hint that re-teaches the idea. Never reference any student. Respond with strict JSON only.',
 'Framework: {framework}. Subject: {subject}. Grade: {grade}.
Learning outcomes the class scored poorly on (no approved bank items exist for these):
{outcome_block}
Teacher notes (optional): {notes}

For each outcome write 3 practice questions with hints and a one-line re-teach summary.
Respond as JSON: {{"title":"...","outcomes":[{{"outcome_ref":"...","reteach":"...","practice":[{{"question":"...","hint":"...","answer":"..."}}]}}]}}',
 '{"type":"object","properties":{"title":{"type":"string"},"outcomes":{"type":"array","minItems":1,"items":{"type":"object","properties":{"outcome_ref":{"type":"string"},"reteach":{"type":"string"},"practice":{"type":"array","minItems":2,"items":{"type":"object","properties":{"question":{"type":"string"},"hint":{"type":"string"},"answer":{"type":"string"}},"required":["question","hint"]}}},"required":["outcome_ref","practice"]}}},"required":["title","outcomes"],"additionalProperties":true}',
 'Remediation set: generated only for outcomes with an empty bank.'),

('saarthi.revision_sheet.v1',
 'You write concise revision sheets for a set of learning outcomes ahead of an exam, in {language_name}. Respond with strict JSON only.',
 'Framework: {framework}. Subject: {subject}. Grade: {grade}. Exam: {notes}
Learning outcomes:
{outcome_block}

For each outcome: 3-5 key points, 2 common errors, and 2 practice questions.
Respond as JSON: {{"title":"...","sections":[{{"outcome_ref":"...","key_points":["..."],"common_errors":["..."],"practice":["..."]}}]}}',
 '{"type":"object","properties":{"title":{"type":"string"},"sections":{"type":"array","minItems":1,"items":{"type":"object","properties":{"outcome_ref":{"type":"string"},"key_points":{"type":"array","minItems":2,"items":{"type":"string"}},"common_errors":{"type":"array","items":{"type":"string"}},"practice":{"type":"array","items":{"type":"string"}}},"required":["outcome_ref","key_points"]}}},"required":["title","sections"],"additionalProperties":true}',
 'Revision sheet.');

insert into prompt_templates (key, version, system_prompt, user_template, output_schema, notes)
select key, 1, sys, usr, schema, notes from _s;
drop table _s;
