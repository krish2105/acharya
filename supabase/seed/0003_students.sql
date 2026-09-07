-- 0003_students.sql
-- 50 synthetic students (with guardians) for Kalanjali, section 6A -- sized to
-- match Section 8's redaction acceptance test ("for 50 seeded students, no
-- student name, admission number, phone or DOB appears in any constructed
-- prompt"). All names are generated from fictional name lists; no real person.
--
-- A handful of Tenant B students exist purely as cross-tenant RLS fixtures.

do $$
declare
  first_names text[] := array['Aarav','Vivaan','Aditya','Vihaan','Arjun','Reyansh','Krishna','Ishaan','Kabir','Ayaan',
                               'Ananya','Diya','Saanvi','Aadhya','Myra','Anika','Ira','Kiara','Pari','Riya',
                               'Rohan','Karan','Nikhil','Yash','Dev','Farhan','Zara','Meher','Ishita','Tanvi',
                               'Advait','Vedant','Shaurya','Atharv','Kian','Neha','Sanya','Naina','Amara','Aisha',
                               'Rudra','Om','Daksh','Veer','Arnav','Tara','Navya','Siya','Anvi','Prisha'];
  last_names text[] := array['Sharma','Verma','Iyer','Nair','Reddy','Gupta','Menon','Rao','Kulkarni','Bose',
                              'Chatterjee','Mehta','Joshi','Kapoor','Malhotra','Bhatt','Pillai','Desai','Chauhan','Kaur'];
  guardian_first text[] := array['Suresh','Anjali','Ramesh','Kavita','Manoj','Sunita','Deepak','Pooja','Rajesh','Neelam'];
  v_school uuid := 'a0000000-0000-0000-0000-000000000001';
  v_section uuid := 'c0000000-0000-0000-0000-000000000001';
  v_student_id uuid;
  v_guardian_id uuid;
  v_full_name text;
  v_admission_no text;
  v_dob date;
  v_phone text;
  v_email text;
begin
  for i in 1..50 loop
    v_full_name := first_names[1 + (i % array_length(first_names, 1))] || ' ' ||
                    last_names[1 + (i % array_length(last_names, 1))];
    v_admission_no := 'KAL-2026-' || lpad(i::text, 4, '0');
    v_dob := date '2014-06-01' + (i * 5 || ' days')::interval;
    v_student_id := gen_random_uuid();

    insert into students (id, school_id, admission_no, full_name, dob, section_id)
    values (v_student_id, v_school, v_admission_no, v_full_name, v_dob, v_section);

    v_guardian_id := gen_random_uuid();
    v_phone := '9' || lpad((100000000 + i)::text, 9, '0');
    v_email := lower(replace(v_full_name, ' ', '.')) || '.parent@example.test';

    insert into guardians (id, school_id, full_name, phone, email)
    values (v_guardian_id, v_school,
            guardian_first[1 + (i % array_length(guardian_first, 1))] || ' ' ||
              last_names[1 + (i % array_length(last_names, 1))],
            v_phone, v_email);

    insert into student_guardians (student_id, guardian_id, relation, is_primary)
    values (v_student_id, v_guardian_id, 'parent', true);
  end loop;
end $$;

-- Tenant B: 5 students, used only to prove cross-tenant RLS isolation.
do $$
declare
  v_school uuid := 'a0000000-0000-0000-0000-000000000002';
  v_section uuid := 'c0000000-0000-0000-0000-000000000002';
begin
  for i in 1..5 loop
    insert into students (school_id, admission_no, full_name, dob, section_id)
    values (v_school, 'RVM-2026-' || lpad(i::text, 4, '0'), 'Rivermist Student ' || i,
            date '2014-08-01' + (i * 3 || ' days')::interval, v_section);
  end loop;
end $$;
