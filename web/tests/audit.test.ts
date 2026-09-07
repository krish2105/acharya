import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { Client as PgClient } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { logEvent } from '@/lib/audit/log-event';
import { verifyChain } from '@/lib/audit/verify-chain';

// Integration test against the local Supabase instance (`supabase start`).
// Uses the service-role key directly (not lib/supabase/service.ts, which is
// guarded by `server-only` for the Next.js bundler and isn't meant to be
// imported from a plain Node test runner).
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54341',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false } },
);

describe('audit chain (integration, requires `supabase start` + seeded db)', () => {
  // audit_events is insert-only and never cleaned up, by design (Section
  // 6.2). Re-running this suite against a shared tenant would pick up a
  // previous run's simulated tamper, so each run creates its own throwaway
  // school and never touches Kalanjali's real chain.
  let schoolId: string;

  beforeAll(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not set -- run tests with `pnpm test` after `source ../worker/.env` or similar');
    }
    schoolId = randomUUID();
    const { error } = await client
      .from('schools')
      .insert({ id: schoolId, name: 'Audit Test Fixture School', slug: `audit-test-${schoolId}` });
    if (error) throw new Error(`fixture school insert failed: ${error.message}`);
  });

  it('30 fresh events verify OK', async () => {
    const entityId = randomUUID();
    for (let i = 0; i < 30; i++) {
      await logEvent(client, {
        schoolId,
        action: 'test_event',
        entityType: 'demo_artifact',
        entityId,
        payload: { i },
      });
    }

    const result = await verifyChain(client, schoolId);
    expect(result).toBe('OK');
  });

  it('detects a row tampered below the insert-only trigger', async () => {
    // audit_events is insert-only for every application-level client (no
    // update/delete grant survives the trigger). To prove verify_chain()
    // actually detects corruption, simulate a lower-level compromise -- a
    // superuser Postgres connection disabling the guard trigger for one
    // corrupting update, the same way this was hand-verified during
    // Phase 0 build (see PROGRESS.md) -- rather than defining any
    // permanent, callable "disable the audit guard" function in the schema.
    const pg = new PgClient({ connectionString: process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54342/postgres' });
    await pg.connect();
    try {
      await pg.query('alter table audit_events disable trigger audit_events_no_update');
      await pg.query(
        `update audit_events set payload = '{"tampered": true}'
         where id = (select min(id) + 5 from audit_events where school_id = $1)`,
        [schoolId],
      );
      await pg.query('alter table audit_events enable trigger audit_events_no_update');
    } finally {
      await pg.end();
    }

    const result = await verifyChain(client, schoolId);
    expect(result).toMatch(/^TAMPERED at id=\d+/);
  });
});
