'use server';

import { revalidatePath } from 'next/cache';
import { logEvent } from '@/lib/audit';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { workerFetch } from '@/lib/worker';

async function requireLeader() {
  const user = await getCurrentUser();
  if (!user || !['principal', 'academic_head'].includes(user.role)) throw new Error('not allowed');
  return user;
}
async function audit(user: Awaited<ReturnType<typeof requireLeader>>, action: string, entityType: string, entityId: string, payload?: Record<string, unknown>) {
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action, entityType, entityId, payload });
}

export async function exportStudentData(studentId: string) {
  const user = await requireLeader();
  const r = await workerFetch<{ path: string; counts: Record<string, number>; bytes: number }>('/dpdp/export', { schoolId: user.schoolId, json: { school_id: user.schoolId, student_id: studentId } });
  await audit(user, 'dpdp.export', 'student', studentId, { counts: r.counts });
  const { data, error } = await createServiceClient().storage.from('evidence').createSignedUrl(r.path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function createErasureRequest(studentId: string, reason: string) {
  const user = await requireLeader();
  const supabase = await createClient();
  const { data, error } = await supabase.from('erasure_requests').insert({ school_id: user.schoolId, student_id: studentId, requested_by_profile: user.id, reason }).select('id').single();
  if (error) throw new Error(error.message);
  await audit(user, 'erasure.request', 'erasure_request', data.id, { student_id: studentId });
  revalidatePath('/consent');
}

export async function decideErasure(requestId: string, decision: 'approved' | 'rejected', note: string) {
  const user = await requireLeader();
  const supabase = await createClient();
  const { error } = await supabase.from('erasure_requests').update({ status: decision, decided_by: user.id, decided_at: new Date().toISOString(), decision_note: note }).eq('id', requestId).eq('status', 'pending');
  if (error) throw new Error(error.message.includes('row-level security') ? 'Your session must pass two-factor authentication to decide erasure requests' : error.message);
  await audit(user, `erasure.${decision}`, 'erasure_request', requestId);
  revalidatePath('/consent');
}

export async function executeErasureRequest(requestId: string) {
  const user = await requireLeader();
  const r = await workerFetch<{ status: string; student_id: string }>('/dpdp/erase', { schoolId: user.schoolId, json: { school_id: user.schoolId, request_id: requestId } });
  await audit(user, 'erasure.execute', 'erasure_request', requestId, { student_id: r.student_id });
  revalidatePath('/consent');
}
