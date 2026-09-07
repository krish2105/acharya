import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54341';

const RIVERMIST_SCHOOL_ID = 'a0000000-0000-0000-0000-000000000002';

describe('cross-tenant RLS isolation (Phase 0 acceptance test, integration)', () => {
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  let kalanjaliTeacherClient: ReturnType<typeof createClient>;

  beforeAll(async () => {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: 'teacher@kalanjali.demo',
      password: 'Demo@2026',
    });
    if (error || !data.session) throw new Error(`seeded login failed: ${error?.message}`);

    kalanjaliTeacherClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });
  });

  it('a Kalanjali (tenant A) user sees only tenant A students, even unfiltered', async () => {
    const { data, error } = await kalanjaliTeacherClient.from('students').select('id, school_id');
    expect(error).toBeNull();
    const students = (data ?? []) as { id: string; school_id: string }[];
    expect(students.length).toBe(50);
    expect(new Set(students.map((s) => s.school_id))).toEqual(
      new Set(['a0000000-0000-0000-0000-000000000001']),
    );
  });

  it('explicitly filtering for tenant B (Rivermist) returns zero rows', async () => {
    const { data: students, error } = await kalanjaliTeacherClient
      .from('students')
      .select('id')
      .eq('school_id', RIVERMIST_SCHOOL_ID);
    expect(error).toBeNull();
    expect(students).toEqual([]);
  });
});
