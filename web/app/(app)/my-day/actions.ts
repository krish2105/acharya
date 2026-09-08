'use server';

import { logEvent } from '@/lib/audit';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createServiceClient } from '@/lib/supabase/service';
import { workerFetch } from '@/lib/worker';
import { signedUrl } from '../saarthi/actions';

export async function buildSubstitutePack(weekday: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error('not authenticated');
  const r = await workerFetch<{ path: string; periods: number }>('/saarthi/substitute-pack', {
    schoolId: user.schoolId,
    json: { school_id: user.schoolId, teacher_id: user.id, weekday },
  });
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'substitute_pack.render', entityType: 'profile', entityId: user.id, payload: { weekday, periods: r.periods } });
  return signedUrl('artifacts', r.path);
}
