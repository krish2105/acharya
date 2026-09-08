import { OutcomeChip } from '@/components/shared/outcome-chip';
import { PageHeader, StatTile } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { CoverageControls, MarkTaughtButton } from './controls';
import { SETU_TABS } from '../nav';

const YEAR = '2026-27';

export default async function CoveragePage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const sp = await searchParams;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();

  let sectionsQ = supabase.from('sections').select('id, grade, section, framework_id, frameworks(code)').order('grade').order('section');
  if (user.role === 'teacher') {
    const { data: tas } = await supabase.from('teaching_assignments').select('section_id').eq('teacher_id', user.id);
    sectionsQ = sectionsQ.in('id', (tas ?? []).map((t) => t.section_id));
  }
  const { data: sections } = await sectionsQ;
  type S = { id: string; grade: string; section: string; framework_id: string; frameworks: { code: string } | null };
  const secs = (sections ?? []) as unknown as S[];
  const current = secs.find((s) => s.id === sp.section) ?? secs[0];

  if (!current) {
    return (
      <div>
        <PageHeader eyebrow="SETU" title="Coverage" tabs={SETU_TABS} current="/setu/coverage" />
        <p className="text-sm text-muted-foreground">No sections assigned.</p>
      </div>
    );
  }

  const [{ data: outcomes }, { data: cov }] = await Promise.all([
    supabase.from('learning_outcomes').select('id, ref_code, statement, subject_id, subjects(name), frameworks(code)').eq('framework_id', current.framework_id).eq('grade', current.grade).order('ref_code'),
    supabase.rpc('effective_coverage', { p_school_id: user.schoolId, p_section_id: current.id, p_academic_year: YEAR }),
  ]);
  type O = { id: string; ref_code: string; statement: string; subject_id: string | null; subjects: { name: string } | null; frameworks: { code: string } | null };
  type C = { learning_outcome_id: string; taught_on: string | null; assessed_count: number; last_assessed_on: string | null; via_outcome_id: string | null };
  const rows = (outcomes ?? []) as unknown as O[];
  const coverage = new Map(((cov ?? []) as C[]).map((c) => [c.learning_outcome_id, c]));
  const taught = rows.filter((o) => coverage.get(o.id)?.taught_on).length;
  const assessed = rows.filter((o) => (coverage.get(o.id)?.assessed_count ?? 0) > 0).length;

  return (
    <div>
      <PageHeader
        eyebrow="SETU"
        title="Coverage"
        description="Per section, per outcome: taught, assessed, last assessed, gaps. Inferred coverage comes only through human-confirmed concept links."
        tabs={SETU_TABS}
        current="/setu/coverage"
        actions={<CoverageControls sections={secs.map((s) => ({ id: s.id, label: `Grade ${s.grade}${s.section} · ${s.frameworks?.code}` }))} current={current.id} />}
      />
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Outcomes in scope" value={rows.length} />
        <StatTile label="Taught" value={`${taught} · ${rows.length ? Math.round((taught / rows.length) * 100) : 0}%`} tone="approved" />
        <StatTile label="Assessed" value={assessed} />
        <StatTile label="Not yet taught" value={rows.length - taught} tone={rows.length - taught > 0 ? 'pending' : 'approved'} />
      </div>
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-4 py-2 font-medium">Outcome</th><th className="px-4 py-2 font-medium">Subject</th><th className="px-4 py-2 font-medium">Taught</th><th className="px-4 py-2 font-medium">Assessed</th><th className="px-4 py-2 font-medium">Last assessed</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const c = coverage.get(o.id);
              return (
                <tr key={o.id} className={`border-t ${c?.taught_on ? '' : 'bg-pending/40'}`}>
                  <td className="px-4 py-2">
                    <OutcomeChip size="sm" outcome={{ frameworkCode: o.frameworks?.code ?? '', refCode: o.ref_code, statement: o.statement }} />
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">{o.statement}</p>
                  </td>
                  <td className="px-4 py-2">{o.subjects?.name ?? '—'}</td>
                  <td className="px-4 py-2 tabular">
                    {c?.taught_on ? new Date(c.taught_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : <span className="text-pending-foreground">Gap</span>}
                    {c?.via_outcome_id && <span className="ml-1 rounded-full bg-secondary px-1.5 text-[10px] text-secondary-foreground">via equivalent</span>}
                  </td>
                  <td className="px-4 py-2 tabular">{c?.assessed_count ?? 0}</td>
                  <td className="px-4 py-2 tabular">{c?.last_assessed_on ? new Date(c.last_assessed_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                  <td className="px-4 py-2 text-right">{!c?.taught_on && <MarkTaughtButton outcomeId={o.id} sectionId={current.id} year={YEAR} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
