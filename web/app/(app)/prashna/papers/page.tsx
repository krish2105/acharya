import Link from 'next/link';
import { PageHeader, StatusPill } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { AssembleDialog } from './assemble-dialog';
import { PRASHNA_TABS, label } from '../nav';

export default async function PapersPage({ searchParams }: { searchParams: Promise<{ assemble?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: papers }, { data: blueprints }, { data: sections }] = await Promise.all([
    supabase.from('papers').select('id, title, exam_kind, scheduled_on, status, compliance, shortfalls, paired_with, blueprints(label), sections(grade, section), paper_items(item_id)').order('scheduled_on', { ascending: false }),
    supabase.from('blueprints').select('id, label, grade').eq('is_active', true).order('label'),
    supabase.from('sections').select('id, grade, section, frameworks(code)').order('grade'),
  ]);
  type P = { id: string; title: string; exam_kind: string; scheduled_on: string | null; status: string; compliance: { total_marks: number; competency_pct: number; competency_ok: boolean; marks_ok: boolean } | null; shortfalls: unknown[] | null; paired_with: string | null; blueprints: { label: string } | null; sections: { grade: string; section: string } | null; paper_items: unknown[] };
  const rows = (papers ?? []) as unknown as P[];

  return (
    <div>
      <PageHeader
        eyebrow="PRASHNA"
        title="Papers"
        description="Assembled by constraint satisfaction from the approved bank. Main/improvement pairs cover the same outcomes with different items."
        tabs={PRASHNA_TABS}
        current="/prashna/papers"
        actions={<AssembleDialog blueprints={blueprints ?? []} sections={(sections ?? []).map((s) => ({ id: s.id, label: `Grade ${s.grade}${s.section} · ${(s.frameworks as unknown as { code: string } | null)?.code ?? ''}` }))} defaultOpen={sp.assemble === '1'} />}
      />
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Paper</th><th className="px-4 py-2 font-medium">Kind</th><th className="px-4 py-2 font-medium">Section</th><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Items</th><th className="px-4 py-2 font-medium">Compliance</th><th className="px-4 py-2 font-medium">Status</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2"><Link href={`/prashna/papers/${p.id}`} className="font-medium hover:text-primary">{p.title}</Link>{p.paired_with && <span className="ml-2 rounded-full bg-secondary px-1.5 text-[10px] text-secondary-foreground">paired</span>}<p className="text-xs text-muted-foreground">{p.blueprints?.label}</p></td>
                <td className="px-4 py-2 capitalize">{label(p.exam_kind)}</td>
                <td className="px-4 py-2">{p.sections ? `${p.sections.grade}${p.sections.section}` : '—'}</td>
                <td className="px-4 py-2 tabular">{p.scheduled_on ?? '—'}</td>
                <td className="px-4 py-2 tabular">{p.paper_items.length}</td>
                <td className="px-4 py-2 text-xs">{p.compliance ? <span className={p.compliance.marks_ok && p.compliance.competency_ok && !(p.shortfalls?.length) ? 'text-approved-foreground' : 'text-pending-foreground'}>{p.compliance.total_marks}m · {p.compliance.competency_pct}% comp{p.shortfalls?.length ? ` · ${p.shortfalls.length} shortfalls` : ''}</span> : <span className="text-muted-foreground">seeded</span>}</td>
                <td className="px-4 py-2"><StatusPill status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
