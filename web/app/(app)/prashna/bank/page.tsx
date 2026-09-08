import Link from 'next/link';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { EmptyState, PageHeader, StatusPill } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { BankFilters } from './filters';
import { BLOOMS, DIFFICULTIES, ITEM_TYPES, PRASHNA_TABS, label } from '../nav';

export default async function BankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: frameworks }, { data: subjects }] = await Promise.all([
    supabase.from('school_frameworks').select('frameworks(id, code)'),
    supabase.from('subjects').select('id, name').order('name'),
  ]);

  let q = supabase
    .from('items')
    .select('id, stem, item_type, marks, cognitive_level, difficulty_intended, status, grade, origin, subjects(name), frameworks(code), item_outcomes(learning_outcomes(ref_code, statement, frameworks(code))), item_stats(flagged, difficulty_observed)')
    .order('updated_at', { ascending: false })
    .limit(150);
  if (sp.status) q = q.eq('status', sp.status);
  if (sp.type) q = q.eq('item_type', sp.type);
  if (sp.bloom) q = q.eq('cognitive_level', sp.bloom);
  if (sp.difficulty) q = q.eq('difficulty_intended', sp.difficulty);
  if (sp.framework) q = q.eq('framework_id', sp.framework);
  if (sp.subject) q = q.eq('subject_id', sp.subject);
  if (sp.grade) q = q.eq('grade', sp.grade);
  if (sp.q) q = q.ilike('stem', `%${sp.q}%`);
  const { data } = await q;

  type Row = { id: string; stem: string; item_type: string; marks: number; cognitive_level: string; difficulty_intended: string | null; status: string; grade: string; origin: string; subjects: { name: string } | null; frameworks: { code: string } | null; item_outcomes: { learning_outcomes: { ref_code: string; statement: string; frameworks: { code: string } | null } | null }[]; item_stats: { flagged: boolean; difficulty_observed: string } | null };
  let rows = (data ?? []) as unknown as Row[];
  if (sp.outcome) rows = rows.filter((r) => r.item_outcomes.some((io) => io.learning_outcomes?.ref_code.toLowerCase().includes(sp.outcome!.toLowerCase())));

  return (
    <div>
      <PageHeader
        eyebrow="PRASHNA"
        title="Item bank"
        description="Filter by outcome, framework, Bloom level, type, difficulty and approval state. Approved items are the shared bank; drafts are private to their author."
        tabs={PRASHNA_TABS}
        current="/prashna/bank"
        actions={<Button render={<Link href="/prashna/bank/new" />} nativeButton={false}>Write an item</Button>}
      />
      <BankFilters frameworks={(frameworks ?? []).map((f) => f.frameworks as unknown as { id: string; code: string }).filter(Boolean)} subjects={subjects ?? []} types={[...ITEM_TYPES]} blooms={[...BLOOMS]} difficulties={[...DIFFICULTIES]} />
      {rows.length === 0 ? (
        <EmptyState title="No items match" body="Loosen the filters, or generate items from an outcome." />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="card-surface flex flex-wrap items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {r.item_outcomes.map((io) => io.learning_outcomes && (
                    <OutcomeChip key={io.learning_outcomes.ref_code} size="sm" outcome={{ frameworkCode: io.learning_outcomes.frameworks?.code ?? '', refCode: io.learning_outcomes.ref_code, statement: io.learning_outcomes.statement }} />
                  ))}
                  <StatusPill status={r.status} />
                  {r.item_stats?.flagged && <span className="rounded-full bg-rejected px-2 py-0.5 text-[11px] font-medium text-rejected-foreground">behaves {r.item_stats.difficulty_observed}</span>}
                </div>
                <Link href={`/prashna/bank/${r.id}`} className="line-clamp-2 text-sm hover:text-primary">{r.stem}</Link>
                <p className="mt-1 text-xs text-muted-foreground capitalize">
                  {label(r.item_type)} · {r.marks} marks · {r.cognitive_level} · {r.difficulty_intended ?? '—'} · Grade {r.grade} · {r.subjects?.name} · {label(r.origin)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{rows.length} shown{rows.length === 150 ? ' (first 150)' : ''}</p>
    </div>
  );
}
