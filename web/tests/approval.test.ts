import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { approveArtifact, transitionArtifactStatus } from '@/lib/approval';

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54341',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false } },
);

const KALANJALI_SCHOOL_ID = 'a0000000-0000-0000-0000-000000000001';
const KALANJALI_TEACHER_ID = 'd0000000-0000-0000-0000-000000000001';

describe('approval flow (integration, requires `supabase start` + seeded db)', () => {
  let artifactId: string;

  beforeAll(async () => {
    artifactId = randomUUID();
    const { error } = await client.from('demo_artifacts').insert({
      id: artifactId,
      school_id: KALANJALI_SCHOOL_ID,
      title: 'Approval flow test fixture',
      generated_version: { text: 'Photosynthesis converts light to energy.' },
      status: 'draft',
      created_by: KALANJALI_TEACHER_ID,
    });
    if (error) throw new Error(`fixture insert failed: ${error.message}`);
  });

  it('rejects skipping straight to a gated status without an approvals row', async () => {
    const { error } = await client
      .from('demo_artifacts')
      .update({ status: 'approved' })
      .eq('id', artifactId);
    expect(error).not.toBeNull();
    expect(error?.message).toContain('cannot enter status');
  });

  it('approveArtifact writes the ledger row with the correct edit distance, then the status transition succeeds', async () => {
    const generated = { text: 'Photosynthesis converts light to energy.' };
    const final = { text: 'Photosynthesis converts sunlight into chemical energy.' };

    const { approvalId, editDistance } = await approveArtifact(client, {
      schoolId: KALANJALI_SCHOOL_ID,
      artifactType: 'demo_artifact',
      artifactId,
      generatedVersion: generated,
      finalVersion: final,
      approvedBy: KALANJALI_TEACHER_ID,
    });

    expect(approvalId).toBeTruthy();
    expect(editDistance).toBeGreaterThan(0);

    const { data: approvalRow } = await client
      .from('approvals')
      .select('*')
      .eq('id', approvalId)
      .single();
    expect(approvalRow?.edit_distance).toBe(editDistance);
    expect(approvalRow?.final_version).toEqual(final);

    // Now the gate is satisfied -- the status transition must succeed.
    await transitionArtifactStatus(client, 'demo_artifacts', artifactId, 'approved');

    const { data: artifact } = await client
      .from('demo_artifacts')
      .select('status')
      .eq('id', artifactId)
      .single();
    expect(artifact?.status).toBe('approved');
  });
});
