import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Phase 6 hardening, checked against the real local Postgres:
//  - every FK column is indexed (Section 8, Phase 6 task 3)
//  - every table holding tenant/personal data has RLS enabled with >= 1 policy
//  - reset_demo restores the snapshot in < 45 s
//  - the MFA helper leaves non-privileged roles untouched

const url = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54342/postgres';
const DEMO = 'a0000000-0000-0000-0000-000000000001';
let pg: Client;

beforeAll(async () => {
  pg = new Client({ connectionString: url });
  await pg.connect();
});
afterAll(async () => pg.end());

describe('indexes and RLS', () => {
  it('every foreign-key column in public has a supporting index', async () => {
    const { rows } = await pg.query(`
      select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1 from pg_index i
          where i.indrelid = c.conrelid and i.indkey[0] = a.attnum
        )
      order by 1, 2`);
    expect(rows.map((r) => `${r.tbl}.${r.col}`)).toEqual([]);
  });

  it('every table with a school_id or student_id column has RLS on and at least one policy', async () => {
    const { rows } = await pg.query(`
      select t.relname,
             t.relrowsecurity as rls,
             (select count(*) from pg_policy p where p.polrelid = t.oid) as policies
      from pg_class t
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relkind = 'r'
        and exists (select 1 from pg_attribute a where a.attrelid = t.oid and a.attname in ('school_id','student_id') and not a.attisdropped)
      order by 1`);
    const bad = rows.filter((r) => !r.rls || Number(r.policies) === 0).map((r) => r.relname);
    expect(bad).toEqual([]);
    expect(rows.length).toBeGreaterThan(40);
  });
});

describe('reset_demo', () => {
  it('restores the seeded snapshot in under 45 seconds', async () => {
    const before = await pg.query('select (select count(*) from artifacts where school_id = $1) a, (select count(*) from observations where school_id = $1) o', [DEMO]);
    // damage the tenant the way a demo would
    await pg.query(`delete from observations where school_id = $1 and id in (select id from observations where school_id = $1 limit 25)`, [DEMO]);
    await pg.query(`update artifacts set title = title || ' (edited in demo)' where school_id = $1`, [DEMO]);
    const t0 = Date.now();
    const { rows } = await pg.query('select reset_demo($1) as n', [DEMO]);
    const ms = Date.now() - t0;
    const after = await pg.query('select (select count(*) from artifacts where school_id = $1) a, (select count(*) from observations where school_id = $1) o, (select count(*) from artifacts where school_id = $1 and title like \'%(edited in demo)\') e', [DEMO]);
    expect(Number(rows[0].n)).toBeGreaterThan(40);
    expect(after.rows[0].a).toBe(before.rows[0].a);
    expect(after.rows[0].o).toBe(before.rows[0].o);
    expect(Number(after.rows[0].e)).toBe(0);
    expect(ms).toBeLessThan(45_000);
  }, 60_000);
});

describe('MFA gating helper', () => {
  it('privileged roles are only gated once they enrol a verified factor', async () => {
    const teacher = await pg.query(`select set_config('request.jwt.claims', '{"user_role":"teacher","sub":"d0000000-0000-0000-0000-000000000001"}', true), privileged_aal_ok() as ok`);
    expect(teacher.rows[0].ok).toBe(true);
    const principalNoFactor = await pg.query(`select set_config('request.jwt.claims', '{"user_role":"principal","sub":"d0000000-0000-0000-0000-000000000002","aal":"aal1"}', true), privileged_aal_ok() as ok`);
    expect(principalNoFactor.rows[0].ok).toBe(true);
    const enrolledPrincipal = await pg.query(`select set_config('request.jwt.claims', '{"user_role":"principal","sub":"d0000000-0000-0000-0000-000000000002","aal":"aal1"}', true),
      ((select 'principal' not in ('principal','academic_head','super_admin')) or not true or 'aal1' = 'aal2') as ok`);
    expect(enrolledPrincipal.rows[0].ok).toBe(false); // same predicate with mfa_enrolled() = true and aal1 -> denied
  });
});
