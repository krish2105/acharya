import { Counter } from '@/components/motion/primitives';
import { PageHeader, StatTile } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { EvidencePackButton } from './evidence-pack-button';
import { UDAY_TABS, YEAR } from './nav';

export default async function UdayDashboard() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const { data } = await supabase.rpc('uday_hours_dashboard', { p_school_id: user.schoolId, p_academic_year: YEAR });
  type Row = { section_id: string; grade: string; section: string; required_hours: number; delivered_hours: number; shortfall: number; weeks_elapsed: number; weeks_total: number; projected_hours: number; projected_shortfall: number; sessions: number; last_delivered: string | null };
  const rows = (data ?? []) as Row[];
  const byGrade = new Map<string, { required: number; delivered: number; sections: number }>();
  for (const r of rows) {
    const g = byGrade.get(r.grade) ?? { required: 0, delivered: 0, sections: 0 };
    byGrade.set(r.grade, { required: g.required + Number(r.required_hours), delivered: g.delivered + Number(r.delivered_hours), sections: g.sections + 1 });
  }
  const totalDelivered = rows.reduce((s, r) => s + Number(r.delivered_hours), 0);
  const totalRequired = rows.reduce((s, r) => s + Number(r.required_hours), 0);
  const atRisk = rows.filter((r) => Number(r.projected_shortfall) > 0).length;

  return (
    <div>
      <PageHeader
        eyebrow="UDAY · dawn"
        title="The AI & CT mandate, delivered and provable."
        description={`Classes 3–5 need 50 hours a year, Classes 6–8 need 100 (CBSE Circular Acad-15/2026). Delivered vs required per section, with a projection at the current pace over 36 teaching weeks. Week ${rows[0]?.weeks_elapsed ?? '—'} of ${rows[0]?.weeks_total ?? 36}.`}
        tabs={UDAY_TABS}
        current="/uday"
        actions={<EvidencePackButton grades={[...byGrade.keys()]} />}
      />
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card-surface p-5"><p className="text-xs text-muted-foreground">Hours delivered (all sections)</p><p className="font-display text-3xl font-medium"><Counter value={Math.round(totalDelivered)} /></p></div>
        <StatTile label="Hours required" value={totalRequired} />
        <StatTile label="Sections projected short" value={atRisk} tone={atRisk ? 'pending' : 'approved'} />
        <StatTile label="Sections tracked" value={rows.length} />
      </div>
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Section</th><th className="px-4 py-2 font-medium">Progress</th><th className="px-4 py-2 font-medium text-right">Delivered</th><th className="px-4 py-2 font-medium text-right">Required</th><th className="px-4 py-2 font-medium text-right">Shortfall</th><th className="px-4 py-2 font-medium text-right">Projected</th><th className="px-4 py-2 font-medium text-right">Projected shortfall</th><th className="px-4 py-2 font-medium">Last session</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const pct = Math.min(100, (Number(r.delivered_hours) / Number(r.required_hours)) * 100);
              const short = Number(r.projected_shortfall) > 0;
              return (
                <tr key={r.section_id} className="border-t">
                  <td className="px-4 py-2 font-medium">Grade {r.grade}{r.section}</td>
                  <td className="px-4 py-2"><div className="h-2 w-40 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${short ? 'bg-pending-foreground' : 'bg-approved-foreground'}`} style={{ width: `${pct}%` }} /></div></td>
                  <td className="px-4 py-2 text-right tabular">{Number(r.delivered_hours).toFixed(1)} h</td>
                  <td className="px-4 py-2 text-right tabular">{r.required_hours} h</td>
                  <td className={`px-4 py-2 text-right tabular ${Number(r.shortfall) > 0 ? 'text-pending-foreground' : 'text-approved-foreground'}`}>{Number(r.shortfall).toFixed(1)} h</td>
                  <td className="px-4 py-2 text-right tabular">{Number(r.projected_hours).toFixed(1)} h</td>
                  <td className={`px-4 py-2 text-right tabular font-medium ${short ? 'text-rejected-foreground' : 'text-approved-foreground'}`}>{short ? `${Number(r.projected_shortfall).toFixed(1)} h` : 'On track'}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.last_delivered ?? '—'} · {r.sessions} sessions</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        {[...byGrade.entries()].map(([g, v]) => (
          <div key={g} className="card-surface p-4"><p className="text-xs text-muted-foreground">Grade {g} · {v.sections} section{v.sections === 1 ? '' : 's'}</p><p className="font-display text-2xl font-medium tabular">{Math.round(v.delivered)}<span className="text-sm text-muted-foreground"> / {v.required} h</span></p></div>
        ))}
      </div>
    </div>
  );
}
