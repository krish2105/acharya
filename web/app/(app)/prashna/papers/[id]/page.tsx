import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { PageHeader, StatTile, StatusPill } from '@/components/shared/page-header';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { PaperActions } from './actions-bar';
import { PRASHNA_TABS, label } from '../../nav';

export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const { data: paper } = await supabase
    .from('papers')
    .select('*, blueprints(label, total_marks, composition), sections(grade, section), paper_items(section_label, q_no, marks, items(id, stem, item_type, cognitive_level, difficulty_intended, item_outcomes(learning_outcomes(ref_code, statement, frameworks(code)))))')
    .eq('id', id)
    .maybeSingle();
  if (!paper) notFound();

  type PI = { section_label: string | null; q_no: string; marks: number; items: { id: string; stem: string; item_type: string; cognitive_level: string; difficulty_intended: string | null; item_outcomes: { learning_outcomes: { ref_code: string; statement: string; frameworks: { code: string } | null } | null }[] } | null };
  const pis = (paper.paper_items as unknown as PI[]).filter((p) => p.items).sort((a, b) => (a.section_label ?? '').localeCompare(b.section_label ?? '') || parseInt(a.q_no.slice(1) || '0') - parseInt(b.q_no.slice(1) || '0'));
  const bySection = new Map<string, PI[]>();
  for (const p of pis) bySection.set(p.section_label ?? 'A', [...(bySection.get(p.section_label ?? 'A') ?? []), p]);
  const titles = new Map<string, string>(((paper.blueprints?.composition?.sections ?? []) as { label: string; title: string }[]).map((s) => [s.label, s.title] as [string, string]));
  const c = paper.compliance as { total_marks: number; target_marks: number; competency_pct: number; competency_target: number; marks_ok: boolean; competency_ok: boolean; bloom: Record<string, number>; bloom_target: Record<string, number>; outcomes_covered: string[]; difficulty: Record<string, number> } | null;
  const shortfalls = (paper.shortfalls ?? []) as { section: string; title: string; needed?: number; available?: number; short_by: number; item_types?: string[]; marks_each?: number; kind?: string }[];
  const canApprove = can(user, 'approve', 'prashna', { subjectId: user.subjectId, frameworkId: user.frameworkId }) || user.role === 'exam_officer';

  return (
    <div>
      <PageHeader
        eyebrow={`PRASHNA · ${label(paper.exam_kind ?? '')} · ${paper.sections ? `Grade ${paper.sections.grade}${paper.sections.section}` : ''}`}
        title={paper.title}
        description={`${paper.blueprints?.label} · ${pis.reduce((s, p) => s + Number(p.marks), 0)} marks · ${paper.scheduled_on ?? 'unscheduled'}`}
        tabs={PRASHNA_TABS}
        current="/prashna/papers"
        actions={<PaperActions paperId={paper.id} status={paper.status} files={(paper.files ?? {}) as Record<string, string>} canApprove={canApprove} hasShortfalls={shortfalls.length > 0} isImprovement={!!paper.paired_with} />}
      />

      <div className="mb-4 flex items-center gap-2 text-sm">
        <StatusPill status={paper.status} />
        {paper.paired_with && <Link href={`/prashna/papers/${paper.paired_with}`} className="text-xs text-primary underline-offset-4 hover:underline">Improvement of main paper →</Link>}
      </div>

      {c && (
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Total marks" value={`${c.total_marks} / ${c.target_marks}`} tone={c.marks_ok ? 'approved' : 'rejected'} hint="within ±2" />
          <StatTile label="Competency-based" value={`${c.competency_pct}%`} hint={`target ${c.competency_target}% (±3)`} tone={c.competency_ok ? 'approved' : 'rejected'} />
          <StatTile label="Outcomes covered" value={c.outcomes_covered.length} />
          <StatTile label="Difficulty" value={Object.entries(c.difficulty).map(([d, n]) => `${n} ${d[0]}`).join(' · ')} />
        </div>
      )}

      {shortfalls.length > 0 && (
        <div className="mb-4 rounded-xl border border-rejected-foreground/30 bg-rejected p-4 text-sm text-rejected-foreground">
          <p className="font-medium">The bank could not satisfy this blueprint. Exact shortfalls:</p>
          <ul className="mt-2 flex flex-col gap-1">
            {shortfalls.map((s, i) => (
              <li key={i}>
                Section {s.section} ({s.title}): {s.kind === 'outcome_coverage' ? `${s.short_by} required outcomes uncovered` : `needs ${s.needed}, bank has ${s.available} — short by ${s.short_by} ${s.item_types?.map(label).join('/')} item(s) at ${s.marks_each} marks`}.
                {s.kind !== 'outcome_coverage' && <Link href={`/prashna/generate`} className="ml-1 underline">Generate candidates</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {c && (
        <div className="card-surface mb-4 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Bloom distribution (marks %)</p>
          <div className="grid grid-cols-6 gap-2 text-xs">
            {Object.entries(c.bloom).map(([b, v]) => (
              <div key={b}><p className="capitalize text-muted-foreground">{b}</p><div className="mt-1 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, v * 2)}%` }} /></div><p className="tabular">{v}% <span className="text-muted-foreground">/ {c.bloom_target[b] ?? 0}%</span></p></div>
            ))}
          </div>
        </div>
      )}

      {[...bySection.entries()].map(([sec, list]) => (
        <section key={sec} className="card-surface mb-4 overflow-hidden">
          <h3 className="border-b px-5 py-3 font-display text-lg font-medium">Section {sec} · {titles.get(sec) ?? ''} <span className="ml-2 text-xs text-muted-foreground tabular">{list.length} × {list[0]?.marks} marks</span></h3>
          <ol>
            {list.map((p) => (
              <li key={p.q_no} className="flex gap-4 border-b px-5 py-3 text-sm last:border-b-0">
                <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">{p.q_no}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/prashna/bank/${p.items!.id}`} className="line-clamp-2 hover:text-primary">{p.items!.stem}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {p.items!.item_outcomes.map((io) => io.learning_outcomes && <OutcomeChip key={io.learning_outcomes.ref_code} size="sm" outcome={{ frameworkCode: io.learning_outcomes.frameworks?.code ?? '', refCode: io.learning_outcomes.ref_code, statement: io.learning_outcomes.statement }} />)}
                    <span className="capitalize">{label(p.items!.item_type)} · {p.items!.cognitive_level} · {p.items!.difficulty_intended}</span>
                  </div>
                </div>
                <span className="tabular text-xs text-muted-foreground">{p.marks}m</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
