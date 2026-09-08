import { redirect } from 'next/navigation';
import { PageHeader, StatTile } from '@/components/shared/page-header';
import { getT } from '@/lib/i18n/server';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminControls } from './controls';

const DEMO_SCHOOL = 'a0000000-0000-0000-0000-000000000001';

export default async function AdminPage() {
  const user = (await getCurrentUser())!;
  if (user.role !== 'super_admin') redirect('/dashboard');
  const { t } = await getT();
  const svc = createServiceClient();
  const [schools, tenantStudents, queue, worker] = await Promise.all([
    svc.from('schools').select('id', { count: 'exact', head: true }),
    svc.from('students').select('id', { count: 'exact', head: true }).eq('school_id', DEMO_SCHOOL),
    svc.from('notification_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    fetch(`${process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://127.0.0.1:8000'}/healthz`, { cache: 'no-store' }).then((r) => (r.ok ? 'up' : `HTTP ${r.status}`)).catch(() => 'unreachable'),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Platform operator" title={t('admin.title')} description={t('admin.sub')} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Tenants" value={schools.count ?? 0} />
        <StatTile label="Demo students" value={tenantStudents.count ?? 0} hint="Kalanjali (fictional)" />
        <StatTile label="Emails queued" value={queue.count ?? 0} />
        <StatTile label="Worker" value={worker} tone={worker === 'up' ? 'approved' : 'rejected'} />
      </div>
      <AdminControls />
    </div>
  );
}
