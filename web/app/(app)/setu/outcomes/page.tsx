import { OutcomeChip } from '@/components/shared/outcome-chip';
import { EmptyState, PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import type { OutcomeRow } from '@/lib/setu/types';
import { ImportDialog } from './import-dialog';
import { OutcomeFilters } from './filters';
import { SETU_TABS } from '../nav';

export default async function OutcomesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: frameworks }, { data: subjects }] = await Promise.all([
    supabase.from('school_frameworks').select('frameworks(id, code, name)'),
    supabase.from('subjects').select('id, code, name').order('name'),
  ]);
  const fws = (frameworks ?? []).map((r) => r.frameworks as unknown as { id: string; code: string; name: string }).filter(Boolean);

  let q = supabase
    .from('learning_outcomes')
    .select('id, ref_code, statement, grade, cognitive_level, framework_id, subject_id, frameworks(code, name), subjects(name, code)')
    .order('ref_code')
    .limit(300);
  if (sp.framework) q = q.eq('framework_id', sp.framework);
  if (sp.subject) q = q.eq('subject_id', sp.subject);
  if (sp.grade) q = q.eq('grade', sp.grade);
  if (sp.q) q = q.or(`statement.ilike.%${sp.q}%,ref_code.ilike.%${sp.q}%`);
  const { data } = await q;
  const rows = (data ?? []) as unknown as OutcomeRow[];

  return (
    <div>
      <PageHeader
        eyebrow="SETU"
        title="Learning outcomes"
        description="Imported from framework documents (CSV, XLSX or PDF), embedded locally, ready to align."
        tabs={SETU_TABS}
        current="/setu/outcomes"
        actions={<ImportDialog frameworks={fws} subjects={subjects ?? []} defaultOpen={sp.import === '1'} />}
      />

      <OutcomeFilters frameworks={fws} subjects={subjects ?? []} />

      {rows.length === 0 ? (
        <EmptyState title="No outcomes match" body="Adjust the filters or import a framework document." />
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Outcome</th>
                <th className="px-4 py-2 font-medium">Grade</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Statement</th>
                <th className="px-4 py-2 font-medium">Bloom</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top hover:bg-muted/30">
                  <td className="px-4 py-2 whitespace-nowrap">
                    <OutcomeChip size="sm" outcome={{ frameworkCode: r.frameworks?.code ?? '', refCode: r.ref_code, statement: r.statement }} />
                  </td>
                  <td className="px-4 py-2 tabular">{r.grade}</td>
                  <td className="px-4 py-2">{r.subjects?.name ?? '—'}</td>
                  <td className="px-4 py-2 max-w-xl">{r.statement}</td>
                  <td className="px-4 py-2 capitalize text-muted-foreground">{r.cognitive_level ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            {rows.length} shown{rows.length === 300 ? ' (first 300 — narrow the filters)' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
