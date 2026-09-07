-- 0002_users.sql
-- Seeded logins for local development and the Phase 0 acceptance tests.
-- All passwords: Demo@2026 (local dev only; never used outside this fixture).
--
-- Directly inserting into auth.users/auth.identities is the standard pattern
-- for local Supabase seed data (GoTrue reads them like any other row); it
-- avoids a separate post-reset script just to create demo logins.

create extension if not exists pgcrypto;

create or replace function seed_auth_user(p_id uuid, p_email text, p_password text)
returns uuid as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token,
    reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email', now(), now()
  );

  return p_id;
end;
$$ language plpgsql;

-- Tenant A: Kalanjali International School, Jaipur
select seed_auth_user('d0000000-0000-0000-0000-000000000001', 'teacher@kalanjali.demo', 'Demo@2026');
select seed_auth_user('d0000000-0000-0000-0000-000000000002', 'academic@kalanjali.demo', 'Demo@2026');
select seed_auth_user('d0000000-0000-0000-0000-000000000003', 'hod@kalanjali.demo', 'Demo@2026');

insert into profiles (id, school_id, full_name, role, subject_id) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Asha Verma', 'teacher', 'b0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Rohan Iyer', 'academic_head', null),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Meera Nair', 'hod', 'b0000000-0000-0000-0000-000000000001');

insert into teaching_assignments (school_id, teacher_id, section_id, subject_id, academic_year) values
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2026-27');

-- Tenant B (Rivermist): one user, used only to prove cross-tenant isolation.
select seed_auth_user('d0000000-0000-0000-0000-000000000011', 'teacher@rivermist-test.demo', 'Demo@2026');

insert into profiles (id, school_id, full_name, role) values
  ('d0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', 'Priya Shah', 'teacher');

drop function seed_auth_user(uuid, text, text);
