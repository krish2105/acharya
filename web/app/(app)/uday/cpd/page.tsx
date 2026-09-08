import { PageHeader, StatTile } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { CpdForm } from './form';
import { UDAY_TABS } from '../nav';

export default async function CpdPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const [{ data: records }, { data: teachers }] = await Promise.all([
    supabase.from('cpd_records').select('id, activity, theme, hours, completed_on, certificate_path, profiles(full_name)').order('completed_on', { ascending: false }),
    supabase.from('profiles').select('id, full_name').in('role', ['teacher', 'hod', 'ct_ai_lead', 'academic_head']).order('full_name'),
  ]);
  type R = { id: string; activity: string; theme: string; hours: number; completed_on: string | null; certificate_path: string | null; profiles: { full_name: string } | null };
  const rows = (records ?? []) as unknown as R[];
  const byTeacher = new Map<string, number>();
  for (const r of rows) byTeacher.set(r.profiles?.full_name ?? '—', (byTeacher.get(r.profiles?.full_name ?? '—') ?? 0) + Number(r.hours));
  const canAddForOthers = ['ct_ai_lead', 'principal', 'academic_head'].includes(user.role);
  return (
    <div>
      <PageHeader eyebrow="UDAY" title="Teacher CPD tracker" description="District Level Deliberations (3–6 CPD hours each), CBSE CoE workshops and in-house sessions on the 2026-27 theme: Computational Thinking and Understanding AI." tabs={UDAY_TABS} current="/uday/cpd" />
      <div className="mb-4 grid grid-cols-3 gap-4">
        <StatTile label="CPD records" value={rows.length} />
        <StatTile label="Teachers covered" value={byTeacher.size} hint={`of ${teachers?.length ?? 0} staff`} />
        <StatTile label="Total CPD hours" value={rows.reduce((s, r) => s + Number(r.hours), 0)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <CpdForm teachers={canAddForOthers ? (teachers ?? []) : [{ id: user.id, full_name: user.fullName }]} />
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Teacher</th><th className="px-4 py-2 font-medium">Activity</th><th className="px-4 py-2 font-medium text-right">Hours</th><th className="px-4 py-2 font-medium">Completed</th><th className="px-4 py-2 font-medium">Certificate</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td className="px-4 py-2">{r.profiles?.full_name}</td><td className="px-4 py-2">{r.activity}<span className="block text-xs text-muted-foreground">{r.theme}</span></td><td className="px-4 py-2 text-right tabular">{r.hours}</td><td className="px-4 py-2 tabular">{r.completed_on ?? '—'}</td><td className="px-4 py-2 text-xs">{r.certificate_path ? 'on file' : '—'}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
