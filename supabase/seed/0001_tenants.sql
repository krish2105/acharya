-- 0001_tenants.sql
-- Two fictional tenants for Phase 0 testing.
--
-- Tenant A: "Kalanjali International School, Jaipur" -- the fixed fictional demo
-- tenant name from rule 10. Minimally seeded here; Phase 6 fills it out fully.
--
-- Tenant B: a second throwaway fictional school that exists ONLY to prove
-- cross-tenant RLS isolation in Phase 0's acceptance test. It is not a demo
-- asset and is not referenced anywhere outside this test fixture.

insert into schools (id, name, slug, city, state, student_count) values
  ('a0000000-0000-0000-0000-000000000001', 'Kalanjali International School, Jaipur', 'kalanjali', 'Jaipur', 'Rajasthan', 5400),
  ('a0000000-0000-0000-0000-000000000002', 'Rivermist Public School', 'rivermist-test', 'Pune', 'Maharashtra', 900);

insert into school_frameworks (school_id, framework_id, grades)
select 'a0000000-0000-0000-0000-000000000001', id, array['1','2','3','4','5','6','7','8','9','10','11','12']
from frameworks where code = 'CBSE';

insert into school_frameworks (school_id, framework_id, grades)
select 'a0000000-0000-0000-0000-000000000001', id, array['11','12']
from frameworks where code = 'IB_DP';

insert into school_frameworks (school_id, framework_id, grades)
select 'a0000000-0000-0000-0000-000000000002', id, array['1','2','3','4','5','6','7','8','9','10']
from frameworks where code = 'CBSE';

insert into subjects (id, school_id, name, code) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Science', 'SCI'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Mathematics', 'MATH'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Science', 'SCI');

insert into sections (id, school_id, grade, section, framework_id)
select 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '6', 'A', id
from frameworks where code = 'CBSE';

insert into sections (id, school_id, grade, section, framework_id)
select 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '6', 'A', id
from frameworks where code = 'CBSE';
