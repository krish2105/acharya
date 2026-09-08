import Link from 'next/link';
import { PageHeader, StatTile } from '@/components/shared/page-header';
import { mySections } from '@/lib/darpan/sections';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { SectionPicker } from './section-picker';
import { CURRENT_TERM, DARPAN_TABS } from './nav';

export default async function DarpanCompletion({ searchParams }: { searchParams: Promise<{ section?: string; term?: string }> }) {
  const sp = await searchParams;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const sections = await mySections(supabase, user);
  const current = sections.find((s) => s.id === sp.section) ?? sections[0];
  const term = sp.term ?? CURRENT_TERM;
  if (!current) return <div><PageHeader eyebrow="DARPAN" title="Completion" tabs={DARPAN_TABS} current="/darpan" /><p className="text-sm text-muted-foreground">No sections assigned.</p></div>;

  const { data } = await supabase.rpc('hpc_completion', { p_school_id: user.schoolId, p_section_id: current.id, p_term: term });
  type Row = { student_id: string; full_name: string; stage: string; domains: number; approved: number; drafted: number; missing: number; observations: number; inputs: number; report_generated: boolean; released: boolean };
  const rows = (data ?? []) as Row[];
  const done = rows.filter((r) => r.approved === r.domains).length;
  const blockedByEvidence = rows.filter((r) => r.observations === 0 && r.inputs === 0).length;

  return (
    <div>
      <PageHeader
        eyebrow="DARPAN · mirror"
        title="An HPC a teacher can actually finish for 40 children."
        description="Per child: how many domain descriptors remain, what is blocking them, and whether the report is generated and released. Sorted by what is blocking."
        tabs={DARPAN_TABS}
        current="/darpan"
        actions={<SectionPicker sections={sections} current={current.id} term={term} />}
      />
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Children" value={rows.length} />
        <StatTile label="All domains approved" value={done} tone="approved" />
        <StatTile label="Descriptors remaining" value={rows.reduce((s, r) => s + (r.domains - r.approved), 0)} tone="pending" />
        <StatTile label="No evidence yet" value={blockedByEvidence} hint="add an observation first" tone={blockedByEvidence ? 'rejected' : 'approved'} />
      </div>
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Child</th><th className="px-4 py-2 font-medium">Evidence</th><th className="px-4 py-2 font-medium">Descriptors</th><th className="px-4 py-2 font-medium">Blocking</th><th className="px-4 py-2 font-medium">Report</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const blocking = r.observations === 0 && r.inputs === 0 ? 'No evidence recorded' : r.missing > 0 ? `${r.missing} domain(s) not drafted` : r.drafted > 0 ? `${r.drafted} draft(s) awaiting approval` : !r.report_generated ? 'Ready to generate' : !r.released ? 'Ready to release' : 'Done';
              return (
                <tr key={r.student_id} className="border-t">
                  <td className="px-4 py-2"><Link href={`/darpan/descriptors/${r.student_id}?term=${encodeURIComponent(term)}`} className="font-medium hover:text-primary">{r.full_name}</Link><span className="block text-xs text-muted-foreground capitalize">{r.stage} stage</span></td>
                  <td className="px-4 py-2 tabular text-xs text-muted-foreground">{r.observations} observations · {r.inputs} inputs</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1" aria-label={`${r.approved} of ${r.domains} approved`}>
                      {Array.from({ length: r.domains }).map((_, i) => <span key={i} className={`h-2 w-6 rounded-full ${i < r.approved ? 'bg-approved-foreground' : i < r.approved + r.drafted ? 'bg-pending-foreground' : 'bg-muted'}`} />)}
                    </div>
                  </td>
                  <td className={`px-4 py-2 text-xs ${blocking === 'Done' ? 'text-approved-foreground' : 'text-pending-foreground'}`}>{blocking}</td>
                  <td className="px-4 py-2 text-xs">{r.released ? <span className="rounded-full bg-approved px-2 py-0.5 text-approved-foreground">Released</span> : r.report_generated ? <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">Generated</span> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
