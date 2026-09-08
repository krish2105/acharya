'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logEvent } from '@/lib/audit';
import { workerFetch } from '@/lib/worker';

export async function submitPortalParentInput(studentId: string, term: string, responses: Record<string, string>, language: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'parent') throw new Error('not allowed');
  const supabase = await createClient();
  // RLS (hpc_inputs_parent) enforces that studentId is this parent's own child.
  const { error } = await supabase.from('hpc_inputs').insert({ school_id: user.schoolId, student_id: studentId, term, source: 'parent', submitted_by: user.id, responses, language });
  if (error) throw new Error(error.message);
  const { data: g } = await supabase.from('guardians').select('id').eq('auth_user_id', user.id).maybeSingle();
  await supabase.from('consent_records').insert({ school_id: user.schoolId, student_id: studentId, guardian_id: g?.id ?? null, purpose: 'parent_input', consent_version: 'v1-2026', granted: true, via: 'portal' });
  revalidatePath('/parent');
}

export async function parentSignedUrl(path: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'parent') throw new Error('not allowed');
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('artifacts').createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

async function requireOwnChild(studentId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'parent') throw new Error('not allowed');
  const supabase = await createClient();
  // RLS: a parent can only select their own children.
  const { data } = await supabase.from('students').select('id').eq('id', studentId).maybeSingle();
  if (!data) throw new Error('not your child');
  return { user, supabase };
}

/** DPDP right of access: everything held about the child, as one JSON file. */
export async function parentExportData(studentId: string) {
  const { user } = await requireOwnChild(studentId);
  const r = await workerFetch<{ path: string; counts: Record<string, number> }>('/dpdp/export', { schoolId: user.schoolId, json: { school_id: user.schoolId, student_id: studentId } });
  const svc = createServiceClient();
  await logEvent(svc, { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'dpdp.export', entityType: 'student', entityId: studentId, payload: { via: 'parent_portal', counts: r.counts } });
  const { data, error } = await svc.storage.from('evidence').createSignedUrl(r.path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** DPDP right to erasure: raises a request that leadership must approve and execute. */
export async function parentRequestErasure(studentId: string, reason: string) {
  const { user, supabase } = await requireOwnChild(studentId);
  const { data: g } = await supabase.from('guardians').select('id').eq('auth_user_id', user.id).maybeSingle();
  const { data, error } = await supabase.from('erasure_requests').insert({ school_id: user.schoolId, student_id: studentId, requested_by_guardian: g?.id ?? null, reason }).select('id').single();
  if (error) throw new Error(error.message);
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'erasure.request', entityType: 'erasure_request', entityId: data.id, payload: { via: 'parent_portal' } });
  revalidatePath('/parent');
}
