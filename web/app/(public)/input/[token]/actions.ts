'use server';

import { logEvent } from '@/lib/audit';
import { createServiceClient } from '@/lib/supabase/service';

/** Single-use token submission. Runs as the service role after validating the
 * token; records a versioned consent row alongside the input (DPDP). */
export async function submitParentInput(token: string, responses: Record<string, string>, language: string, consent: boolean) {
  if (!consent) throw new Error('consent is required');
  const svc = createServiceClient();
  const { data: t } = await svc.from('hpc_input_tokens').select('token, school_id, student_id, guardian_id, term, expires_at, used_at').eq('token', token).maybeSingle();
  if (!t || t.used_at || new Date(t.expires_at) < new Date()) throw new Error('link expired or already used');
  const { error } = await svc.from('hpc_inputs').insert({ school_id: t.school_id, student_id: t.student_id, term: t.term, source: 'parent', submitted_by: null, responses, language });
  if (error) throw new Error(error.message);
  await svc.from('consent_records').insert({ school_id: t.school_id, student_id: t.student_id, guardian_id: t.guardian_id, purpose: 'parent_input', consent_version: 'v1-2026', granted: true, via: 'token_link' });
  await svc.from('hpc_input_tokens').update({ used_at: new Date().toISOString() }).eq('token', token);
  await logEvent(svc, { schoolId: t.school_id, actorId: null, actorRole: 'parent', action: 'hpc_input.parent_submit', entityType: 'student', entityId: t.student_id, payload: { term: t.term, via: 'token_link' } });
}
