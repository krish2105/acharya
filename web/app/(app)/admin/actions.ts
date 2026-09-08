'use server';

import { logEvent } from '@/lib/audit';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createServiceClient } from '@/lib/supabase/service';
import { workerFetch } from '@/lib/worker';

const DEMO_SCHOOL = 'a0000000-0000-0000-0000-000000000001';

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'super_admin') throw new Error('super_admin only');
  return user;
}

export async function resetDemo() {
  const user = await requireSuperAdmin();
  const svc = createServiceClient();
  const started = Date.now();
  const { data, error } = await svc.rpc('reset_demo', { p_school_id: DEMO_SCHOOL });
  if (error) throw new Error(error.message);
  const ms = Date.now() - started;
  await logEvent(svc, { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'demo.reset', entityType: 'school', entityId: DEMO_SCHOOL, payload: { tables: data, ms } });
  return { tables: data as number, ms };
}

export async function flushNotifications() {
  const user = await requireSuperAdmin();
  const enq = await workerFetch<{ hod_digests: number; descriptor_reminders: number }>('/notify/enqueue-now', { schoolId: user.schoolId, json: {} });
  const sent = await workerFetch<{ sent: number; failed: number; transport: string }>('/notify/flush', { schoolId: user.schoolId, json: {} });
  return { ...enq, ...sent };
}
