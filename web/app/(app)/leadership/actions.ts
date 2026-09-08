'use server';

import { logEvent } from '@/lib/audit';
import { buildLeadershipSummary } from '@/lib/leadership';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createServiceClient } from '@/lib/supabase/service';
import { workerFetch } from '@/lib/worker';

export async function exportLeadershipPdf(windowDays: number) {
  const user = await getCurrentUser();
  if (!user || !['principal', 'academic_head'].includes(user.role)) throw new Error('not allowed');
  const svc = createServiceClient();
  const summary = await buildLeadershipSummary(svc, user.schoolId, windowDays);
  const r = await workerFetch<{ path: string }>('/leadership/report', { schoolId: user.schoolId, json: { school_id: user.schoolId, summary } });
  await logEvent(svc, { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'leadership_report.render', entityType: 'school', entityId: user.schoolId, payload: { window_days: windowDays } });
  const { data, error } = await svc.storage.from('artifacts').createSignedUrl(r.path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
