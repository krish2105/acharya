import { Counter } from '@/components/motion/primitives';
import { PageHeader, StatTile } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { SAARTHI_TABS } from '../nav';

export default async function TimeSavedPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const { data } = await supabase.rpc('time_saved_summary', { p_school_id: user.schoolId });
  type Row = { subject_id: string | null; subject: string | null; teacher_id: string; teacher: string; approved: number; drafts_reused: number; avg_edit_distance: number | null; hours_saved: number };
  const rows = (data ?? []) as Row[];
  const dept = new Map<string, { approved: number; reused: number; hours: number }>();
  for (const r of rows) {
    const k = r.subject ?? 'Unassigned';
    const d = dept.get(k) ?? { approved: 0, reused: 0, hours: 0 };
    dept.set(k, { approved: d.approved + r.approved, reused: d.reused + r.drafts_reused, hours: d.hours + Number(r.hours_saved) });
  }
  const total = rows.reduce((s, r) => s + Number(r.hours_saved), 0);
  const mine = rows.filter((r) => r.teacher_id === user.id).reduce((s, r) => s + Number(r.hours_saved), 0);

  return (
    <div>
      <PageHeader eyebrow="SAARTHI" title="My time saved" description="Artifacts approved, drafts reused, and estimated hours — per teacher and per department. Conservative minutes-per-kind estimates of writing from scratch." tabs={SAARTHI_TABS} current="/saarthi/time-saved" />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="card-surface p-5"><p className="text-xs text-muted-foreground">Your hours saved</p><p className="font-display text-4xl font-medium text-primary"><Counter value={Math.round(mine)} /></p></div>
        <div className="card-surface p-5"><p className="text-xs text-muted-foreground">School-wide hours saved</p><p className="font-display text-4xl font-medium"><Counter value={Math.round(total)} /></p></div>
        <StatTile label="Departments" value={dept.size} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-surface overflow-hidden">
          <h3 className="border-b px-5 py-3 text-sm font-medium text-muted-foreground">Per department</h3>
          <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="px-5 py-2 font-medium">Department</th><th className="px-5 py-2 text-right font-medium">Approved</th><th className="px-5 py-2 text-right font-medium">Reused</th><th className="px-5 py-2 text-right font-medium">Hours</th></tr></thead>
            <tbody>{[...dept.entries()].sort((a, b) => b[1].hours - a[1].hours).map(([k, v]) => <tr key={k} className="border-t"><td className="px-5 py-2">{k}</td><td className="px-5 py-2 text-right tabular">{v.approved}</td><td className="px-5 py-2 text-right tabular">{v.reused}</td><td className="px-5 py-2 text-right tabular font-medium">{v.hours.toFixed(1)}</td></tr>)}</tbody></table>
        </section>
        <section className="card-surface overflow-hidden">
          <h3 className="border-b px-5 py-3 text-sm font-medium text-muted-foreground">Per teacher</h3>
          <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="px-5 py-2 font-medium">Teacher</th><th className="px-5 py-2 font-medium">Subject</th><th className="px-5 py-2 text-right font-medium">Approved</th><th className="px-5 py-2 text-right font-medium">Avg edit</th><th className="px-5 py-2 text-right font-medium">Hours</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-t"><td className="px-5 py-2">{r.teacher}</td><td className="px-5 py-2 text-muted-foreground">{r.subject}</td><td className="px-5 py-2 text-right tabular">{r.approved}</td><td className="px-5 py-2 text-right tabular">{r.avg_edit_distance ?? '—'}</td><td className="px-5 py-2 text-right tabular font-medium">{Number(r.hours_saved).toFixed(1)}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">No approved artifacts yet.</td></tr>}</tbody></table>
        </section>
      </div>
    </div>
  );
}
