-- 0001_tenancy.sql
-- Tenancy and academic structure. Every tenant-scoped table gets an RLS policy (rule 11):
-- a table with personal or tenant data and no policy is a build failure.

-- Enabled now so SETU (Phase 1) can add `vector` columns without a further
-- extension migration; unused until then.
create extension if not exists vector with schema extensions;

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  city text,
  state text,
  timezone text default 'Asia/Kolkata',
  student_count int,
  created_at timestamptz not null default now()
);

-- frameworks is shared reference data (the four boards), not tenant-scoped.
create table frameworks (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,               -- 'CBSE','IB_MYP','IB_DP','CAMB_PRIMARY','CAMB_LOWER_SEC','IGCSE','AP'
  name text not null,
  stage_model text,                        -- 'foundational_preparatory_middle_secondary', 'myp_years', etc.
  created_at timestamptz not null default now()
);

create table school_frameworks (
  school_id uuid not null references schools(id) on delete cascade,
  framework_id uuid not null references frameworks(id) on delete cascade,
  grades text[] not null,                  -- which grades run this framework
  primary key (school_id, framework_id)
);

create type app_role as enum (
  'super_admin','principal','academic_head','board_coordinator','hod','teacher',
  'ct_ai_lead','exam_officer','parent','student'
);

-- profiles mirrors auth.users 1:1 and carries the JWT custom-claim source fields.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id),
  full_name text not null,
  role app_role not null,
  framework_id uuid references frameworks(id),   -- for board_coordinator
  subject_id uuid,                               -- for hod (FK added after subjects exists)
  is_active boolean default true,
  created_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  unique (school_id, code)
);

alter table profiles
  add constraint profiles_subject_id_fkey foreign key (subject_id) references subjects(id);

create table sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  grade text not null,                     -- 'Nursery','1'..'12'
  section text not null,
  framework_id uuid not null references frameworks(id),
  created_at timestamptz not null default now(),
  unique (school_id, grade, section)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  admission_no text not null,
  full_name text not null,
  dob date not null,
  section_id uuid references sections(id),
  previous_framework_id uuid references frameworks(id),   -- for board-transition gap reports
  is_active boolean default true,
  created_at timestamptz not null default now(),
  unique (school_id, admission_no)
);

create table teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  teacher_id uuid references profiles(id),
  section_id uuid references sections(id),
  subject_id uuid references subjects(id),
  academic_year text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, section_id, subject_id, academic_year)
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  full_name text not null,
  phone text,
  email text,
  auth_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table student_guardians (
  student_id uuid not null references students(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  relation text,
  is_primary boolean default false,
  primary key (student_id, guardian_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table schools enable row level security;
alter table frameworks enable row level security;
alter table school_frameworks enable row level security;
alter table profiles enable row level security;
alter table subjects enable row level security;
alter table sections enable row level security;
alter table students enable row level security;
alter table teaching_assignments enable row level security;
alter table guardians enable row level security;
alter table student_guardians enable row level security;

-- frameworks: shared read-only reference data, visible to every authenticated user.
create policy frameworks_read on frameworks for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- schools: a user may read only their own school row.
create policy schools_tenant_read on schools for select
  using (id = (auth.jwt() ->> 'school_id')::uuid);

create policy school_frameworks_tenant_isolation on school_frameworks for all
  using (school_id = (auth.jwt() ->> 'school_id')::uuid);

create policy profiles_tenant_isolation on profiles for all
  using (school_id = (auth.jwt() ->> 'school_id')::uuid);

create policy subjects_tenant_isolation on subjects for all
  using (school_id = (auth.jwt() ->> 'school_id')::uuid);

create policy sections_tenant_isolation on sections for all
  using (school_id = (auth.jwt() ->> 'school_id')::uuid);

-- staff see the tenant's students; parents and students are scoped to their
-- own rows by the DARPAN migration's students_parent_read policy.
create policy students_tenant_isolation on students for all
  using (school_id = (auth.jwt() ->> 'school_id')::uuid
         and coalesce(auth.jwt() ->> 'user_role', '') not in ('parent','student'));

create policy teaching_assignments_tenant_isolation on teaching_assignments for all
  using (school_id = (auth.jwt() ->> 'school_id')::uuid);

create policy guardians_tenant_isolation on guardians for all
  using (school_id = (auth.jwt() ->> 'school_id')::uuid
         and coalesce(auth.jwt() ->> 'user_role', '') not in ('parent','student'));
create policy guardians_self_read on guardians for select using (auth_user_id = auth.uid());

-- student_guardians has no school_id column; scope via the referenced student.
create policy student_guardians_tenant_isolation on student_guardians for all
  using (
    exists (
      select 1 from students st
      where st.id = student_guardians.student_id
        and st.school_id = (auth.jwt() ->> 'school_id')::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- Seed: the four boards (as framework rows; some boards span multiple
-- stage-specific curricula, e.g. IB has MYP and DP).
-- ---------------------------------------------------------------------------

insert into frameworks (code, name, stage_model) values
  ('CBSE', 'CBSE', 'foundational_preparatory_middle_secondary'),
  ('IB_MYP', 'IB Middle Years Programme', 'myp_years'),
  ('IB_DP', 'IB Diploma Programme', 'dp_years'),
  ('CAMB_PRIMARY', 'Cambridge Primary', 'primary_stages'),
  ('CAMB_LOWER_SEC', 'Cambridge Lower Secondary', 'lower_secondary_stages'),
  ('IGCSE', 'Cambridge IGCSE', 'igcse_years'),
  ('AP', 'Advanced Placement', 'ap_courses');

-- ---------------------------------------------------------------------------
-- Custom JWT claims (task 3): school_id, user_role, framework_id, subject_id
-- are injected into every access token from `profiles`, via a Supabase Auth
-- Hook. RLS policies throughout the schema read these off auth.jwt().
--
-- DEVIATION FROM THE MASTER DOC: the app role claim is named `user_role`,
-- not `role`. PostgREST reserves the JWT claim key `role` to select which
-- Postgres database role executes the request (normally `authenticated`);
-- overwriting it with an app-level value like 'teacher' breaks PostgREST's
-- own role switching ("role \"teacher\" does not exist"). Section 6.8's
-- illustrative RLS snippets read `auth.jwt() ->> 'role'` for the app role --
-- every future phase's RLS policy must use `user_role` instead. See
-- docs/ARCHITECTURE.md.
-- ---------------------------------------------------------------------------

create function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable as $$
declare
  claims jsonb;
  v_school_id uuid;
  v_role text;
  v_framework_id uuid;
  v_subject_id uuid;
begin
  select school_id, role::text, framework_id, subject_id
    into v_school_id, v_role, v_framework_id, v_subject_id
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);

  if v_school_id is not null then
    claims := jsonb_set(claims, '{school_id}', to_jsonb(v_school_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
    -- jsonb_set with a SQL NULL value nulls the whole result, so framework_id
    -- and subject_id (legitimately null for most roles) are only set when present.
    claims := jsonb_set(claims, '{framework_id}', coalesce(to_jsonb(v_framework_id::text), 'null'::jsonb));
    claims := jsonb_set(claims, '{subject_id}', coalesce(to_jsonb(v_subject_id::text), 'null'::jsonb));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

grant select on public.profiles to supabase_auth_admin;

create policy profiles_auth_admin_read on profiles for select
  to supabase_auth_admin using (true);
