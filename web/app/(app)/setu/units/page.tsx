import Link from 'next/link';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { EmptyState, PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { NewUnitDialog } from './new-unit-dialog';
import { SETU_TABS } from '../nav';

export default async function UnitsPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const [{ data: units }, { data: frameworks }, { data: subjects }] = await Promise.all([
    supabase
      .from('units')
      .select('id, title, grade, planned_hours, sequence_no, academic_year, frameworks(code), subjects(name), unit_outcomes(learning_outcomes(ref_code, statement, frameworks(code)))')
      .order('grade')
      .order('sequence_no'),
    supabase.from('school_frameworks').select('frameworks(id, code, name)'),
    supabase.from('subjects').select('id, name').order('name'),
  ]);
  const fws = (frameworks ?? []).map((r) => r.frameworks as unknown as { id: string; code: string; name: string }).filter(Boolean);

  type U = { id: string; title: string; grade: string; planned_hours: number | null; sequence_no: number | null; academic_year: string; frameworks: { code: string } | null; subjects: { name: string } | null; unit_outcomes: { learning_outcomes: { ref_code: string; statement: string; frameworks: { code: string } | null } | null }[] };
  const rows = (units ?? []) as unknown as U[];
  const groups = new Map<string, U[]>();
  for (const u of rows) {
    const k = `Grade ${u.grade} · ${u.frameworks?.code ?? '—'}`;
    groups.set(k, [...(groups.get(k) ?? []), u]);
  }

  return (
    <div>
      <PageHeader
        eyebrow="SETU"
        title="Units & pacing"
        description="Teachable units of work with outcomes attached across frameworks, sequenced across the year."
        tabs={SETU_TABS}
        current="/setu/units"
        actions={
          <>
            <Button variant="outline" render={<Link href="/setu/units/planner" />} nativeButton={false}>
              Multi-board planner
            </Button>
            <NewUnitDialog frameworks={fws} subjects={subjects ?? []} />
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No units yet" body="Create a unit and attach outcomes from any framework." />
      ) : (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([label, us]) => (
            <section key={label}>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">{label}</h3>
              <ol className="grid gap-3 md:grid-cols-2">
                {us.map((u) => (
                  <li key={u.id} className="card-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">Unit {u.sequence_no ?? '—'} · {u.academic_year}</p>
                        <Link href={`/setu/units/${u.id}`} className="font-display text-lg font-medium hover:text-primary">{u.title}</Link>
                        <p className="text-xs text-muted-foreground">{u.subjects?.name} · {u.planned_hours ?? '—'} h planned</p>
                      </div>
                      <span className="tabular rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{u.unit_outcomes.length} outcomes</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {u.unit_outcomes.slice(0, 6).map((uo) => uo.learning_outcomes && (
                        <OutcomeChip key={uo.learning_outcomes.ref_code} size="sm" outcome={{ frameworkCode: uo.learning_outcomes.frameworks?.code ?? '', refCode: uo.learning_outcomes.ref_code, statement: uo.learning_outcomes.statement }} />
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Showing units for {user.schoolName}.</p>
    </div>
  );
}
