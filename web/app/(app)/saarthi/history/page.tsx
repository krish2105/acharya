import Link from 'next/link';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { EmptyState, PageHeader, StatusPill } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { KIND_LABEL, KINDS, SAARTHI_TABS } from '../nav';

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase
    .from('artifacts')
    .select('id, kind, title, status, language, grade, updated_at, origin, subjects(name), frameworks(code), profiles!artifacts_created_by_fkey(full_name), artifact_outcomes(learning_outcomes(ref_code, statement, frameworks(code)))')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (sp.kind) q = q.eq('kind', sp.kind);
  if (sp.status) q = q.eq('status', sp.status);
  const { data } = await q;
  type A = { id: string; kind: string; title: string; status: string; language: string; grade: string | null; updated_at: string; origin: string; subjects: { name: string } | null; frameworks: { code: string } | null; profiles: { full_name: string } | null; artifact_outcomes: { learning_outcomes: { ref_code: string; statement: string; frameworks: { code: string } | null } | null }[] };
  const rows = (data ?? []) as unknown as A[];

  return (
    <div>
      <PageHeader eyebrow="SAARTHI" title="My artifacts" description="Everything you drafted, approved or received from your department. Open one to see what changed since the generated version." tabs={SAARTHI_TABS} current="/saarthi/history" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/saarthi/history" className={`rounded-full border px-3 py-1 text-xs ${!sp.kind && !sp.status ? 'border-primary bg-primary-soft text-primary' : ''}`}>All</Link>
        {KINDS.map((k) => <Link key={k} href={`/saarthi/history?kind=${k}`} className={`rounded-full border px-3 py-1 text-xs ${sp.kind === k ? 'border-primary bg-primary-soft text-primary' : ''}`}>{KIND_LABEL[k]}</Link>)}
        {['draft', 'approved', 'shared'].map((s) => <Link key={s} href={`/saarthi/history?status=${s}`} className={`rounded-full border px-3 py-1 text-xs capitalize ${sp.status === s ? 'border-primary bg-primary-soft text-primary' : ''}`}>{s}</Link>)}
      </div>
      {rows.length === 0 ? <EmptyState title="No artifacts yet" body="Draft a lesson plan or worksheet from a unit to get started." /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((a) => (
            <li key={a.id} className="card-surface p-4">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {a.artifact_outcomes.slice(0, 3).map((ao) => ao.learning_outcomes && <OutcomeChip key={ao.learning_outcomes.ref_code} size="sm" outcome={{ frameworkCode: ao.learning_outcomes.frameworks?.code ?? '', refCode: ao.learning_outcomes.ref_code, statement: ao.learning_outcomes.statement }} />)}
                <StatusPill status={a.status} />
                {a.language === 'hi' && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">हिन्दी</span>}
              </div>
              <Link href={`/saarthi/history/${a.id}`} className="font-display text-lg font-medium hover:text-primary">{a.title}</Link>
              <p className="mt-1 text-xs text-muted-foreground">{KIND_LABEL[a.kind as keyof typeof KIND_LABEL]} · {a.subjects?.name} · Grade {a.grade} · {a.profiles?.full_name} · {new Date(a.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
