-- 0002_audit_gateway_approval.sql
-- Audit chain, AI gateway tables, and the approval ledger. Built before any feature,
-- per Section 6.2: this is what makes the approval gate and the audit trail
-- database-enforced rather than an application-layer convention.

-- ---------------------------------------------------------------------------
-- Hash-chained audit log (insert-only)
-- ---------------------------------------------------------------------------

create table audit_events (
  id bigserial primary key,
  school_id uuid not null references schools(id),
  actor_id uuid,
  actor_role app_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  prev_hash text,
  hash text not null
);

create index audit_events_school_id_id_idx on audit_events (school_id, id);

-- hash = sha256( prev_hash || school_id || action || entity_id || payload::text || occurred_at )
-- The chain is scoped per school_id: prev_hash links to the most recent audit_events
-- row for the same tenant. hash/prev_hash are always server-computed; the caller's
-- values (if any) are ignored.
create function audit_events_set_hash() returns trigger as $$
declare
  v_prev_hash text;
begin
  select hash into v_prev_hash
  from audit_events
  where school_id = new.school_id
  order by id desc
  limit 1;

  new.prev_hash := v_prev_hash;
  new.hash := encode(
    sha256(
      (coalesce(v_prev_hash, '') || new.school_id::text || new.action ||
       coalesce(new.entity_id::text, '') || new.payload::text || new.occurred_at::text)::bytea
    ),
    'hex'
  );
  return new;
end;
$$ language plpgsql;

create trigger audit_events_before_insert
  before insert on audit_events
  for each row execute function audit_events_set_hash();

-- Insert-only: no update or delete, ever.
create function reject_mutation() returns trigger as $$
begin
  raise exception 'audit_events is insert-only';
end;
$$ language plpgsql;

create trigger audit_events_no_update
  before update on audit_events
  for each row execute function reject_mutation();

create trigger audit_events_no_delete
  before delete on audit_events
  for each row execute function reject_mutation();

-- Verifies the hash chain for one school (or every school when p_school_id is null).
-- Returns 'OK' if every row's stored hash matches its recomputed hash and every
-- row's prev_hash matches the previous row's stored hash; otherwise returns a
-- description of the first row where the chain breaks.
create function verify_chain(p_school_id uuid default null) returns text as $$
declare
  r record;
  v_prev_hash text;
  v_prev_school uuid;
  v_expected text;
begin
  v_prev_hash := null;
  v_prev_school := null;

  for r in
    select * from audit_events
    where p_school_id is null or school_id = p_school_id
    order by school_id, id
  loop
    if r.school_id is distinct from v_prev_school then
      v_prev_hash := null;
    end if;

    if r.prev_hash is distinct from v_prev_hash then
      return format('TAMPERED at id=%s: prev_hash does not match preceding row', r.id);
    end if;

    v_expected := encode(
      sha256(
        (coalesce(v_prev_hash, '') || r.school_id::text || r.action ||
         coalesce(r.entity_id::text, '') || r.payload::text || r.occurred_at::text)::bytea
      ),
      'hex'
    );

    if r.hash is distinct from v_expected then
      return format('TAMPERED at id=%s: hash does not match row content', r.id);
    end if;

    v_prev_hash := r.hash;
    v_prev_school := r.school_id;
  end loop;

  return 'OK';
end;
$$ language plpgsql;

alter table audit_events enable row level security;

create policy audit_events_tenant_read on audit_events for select
  using (school_id = (auth.jwt() ->> 'school_id')::uuid);

-- Inserts happen via the service role (worker/server actions), never directly
-- from a client role, so no insert policy is granted to authenticated/anon.

-- ---------------------------------------------------------------------------
-- AI gateway: versioned prompt templates + generation log
-- ---------------------------------------------------------------------------

create table prompt_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,                       -- 'item.competency.v1','descriptor.hpc.v2'
  version int not null,
  system_prompt text not null,
  user_template text not null,
  output_schema jsonb not null,            -- JSON schema; output is validated against this
  notes text,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  unique (key, version)
);

alter table prompt_templates enable row level security;

create policy prompt_templates_read on prompt_templates for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create table generation_log (
  id bigserial primary key,
  school_id uuid not null references schools(id),
  actor_id uuid,
  template_key text not null,
  template_version int not null,
  provider text not null,
  model text not null,
  redacted_prompt_hash text not null,      -- hash only. NEVER store the raw prompt.
  redaction_count int not null,            -- how many PII spans were removed
  input_tokens int,
  output_tokens int,
  latency_ms int,
  output jsonb,
  validation_result text check (validation_result in ('valid','retried_valid','invalid')),
  artifact_type text,
  artifact_id uuid,
  created_at timestamptz not null default now()
);

alter table generation_log enable row level security;

create policy generation_log_tenant_isolation on generation_log for all
  using (school_id = (auth.jwt() ->> 'school_id')::uuid);

-- ---------------------------------------------------------------------------
-- Approvals: the human-in-the-loop ledger
-- ---------------------------------------------------------------------------

create table approvals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  artifact_type text not null,             -- 'item','paper','lesson_plan','worksheet','rubric','message','descriptor',...
  artifact_id uuid not null,
  generated_version jsonb not null,        -- what the model produced
  final_version jsonb not null,            -- what the human approved
  edit_distance numeric,                   -- how much the teacher changed
  approved_by uuid not null references profiles(id),
  approved_at timestamptz not null default now(),
  unique (artifact_type, artifact_id)
);

alter table approvals enable row level security;

create policy approvals_tenant_isolation on approvals for all
  using (school_id = (auth.jwt() ->> 'school_id')::uuid);

-- Generic, reusable approval-gate trigger. Attach to any artifact table with a
-- `status` column: before that row is allowed into a gated status (e.g.
-- 'approved', 'published', 'printed', 'assigned', 'shared'), a matching row
-- must already exist in `approvals`. This is what makes rule 2.1.4 a database
-- constraint instead of an application convention -- every future phase's
-- artifact table (items, papers, artifacts, hpc_descriptors, ...) reuses this
-- same function; it takes no hardcoded table knowledge.
--
-- Trigger args: arg0 = artifact_type string used in the `approvals` table,
-- arg1 = comma-separated list of gated status values.
create function enforce_approval_gate() returns trigger as $$
declare
  v_artifact_type text := tg_argv[0];
  v_gated_statuses text[] := string_to_array(tg_argv[1], ',');
begin
  if new.status = any(v_gated_statuses) then
    if not exists (
      select 1 from approvals
      where artifact_type = v_artifact_type
        and artifact_id = new.id
        and approved_at is not null
    ) then
      raise exception
        'artifact % (type=%) cannot enter status "%" without a matching approvals row',
        new.id, v_artifact_type, new.status;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Phase 0 demo artifact: exists only to prove the approval card, the outcome
-- chip, and the DB-enforced approval gate end to end (Section 8, task 9 and
-- the "approved without approvals row is rejected" acceptance test), ahead of
-- any real feature module. Phase 3 (SAARTHI) introduces the real `artifacts`
-- table; this one is not it and is not extended by later migrations.
-- ---------------------------------------------------------------------------

create table demo_artifacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  title text not null,
  generated_version jsonb not null,
  final_version jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'published')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table demo_artifacts enable row level security;

create policy demo_artifacts_tenant_isolation on demo_artifacts for all
  using (school_id = (auth.jwt() ->> 'school_id')::uuid);

create trigger demo_artifacts_approval_gate
  before insert or update on demo_artifacts
  for each row execute function enforce_approval_gate('demo_artifact', 'approved,published');
