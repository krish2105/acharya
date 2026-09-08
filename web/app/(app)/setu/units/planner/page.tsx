import { OutcomeChip } from '@/components/shared/outcome-chip';
import { EmptyState, PageHeader } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { SETU_TABS } from '../../nav';

/**
 * Multi-board planning view (Phase 1 task 11): a teacher taking Grade 9 CBSE
 * and Grade 9 IGCSE sees one plan with both outcome sets attached.
 */
export default async function PlannerPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();

  let taQuery = supabase.from('teaching_assignments').select('section_id, academic_year, sections(id, grade, section, framework_id, frameworks(code, name)), subjects(id, name)');
  if (user.role === 'teacher') taQuery = taQuery.eq('teacher_id', user.id);
  const { data: tas } = await taQuery;

  type TA = { section_id: string; academic_year: string; sections: { id: string; grade: string; section: string; framework_id: string; frameworks: { code: string; name: string } | null } | null; subjects: { id: string; name: string } | null };
  const assignments = ((tas ?? []) as unknown as TA[]).filter((t) => t.sections);

  const byGrade = new Map<string, TA[]>();
  for (const t of assignments) byGrade.set(t.sections!.grade, [...(byGrade.get(t.sections!.grade) ?? []), t]);

  const { data: units } = await supabase
    .from('units')
    .select('id, title, grade, framework_id, sequence_no, planned_hours, subject_id, unit_outcomes(learning_outcomes(id, ref_code, statement, frameworks(code)))')
    .order('sequence_no');
  type U = { id: string; title: string; grade: string; framework_id: string; sequence_no: number | null; planned_hours: number | null; subject_id: string | null; unit_outcomes: { learning_outcomes: { id: string; ref_code: string; statement: string; frameworks: { code: string } | null } | null }[] };
  const allUnits = (units ?? []) as unknown as U[];

  const multi = [...byGrade.entries()].filter(([, ts]) => new Set(ts.map((t) => t.sections!.framework_id)).size > 1);

  return (
    <div>
      <PageHeader
        eyebrow="SETU"
        title="Multi-board planner"
        description="Where you teach the same grade under two boards, plan once: both outcome sets side by side, unit by unit."
        tabs={SETU_TABS}
        current="/setu/units"
      />
      {multi.length === 0 ? (
        <EmptyState title="No multi-board grades" body="This view appears when a teacher holds the same grade under two different frameworks (e.g. Grade 9 CBSE and Grade 9 IGCSE)." />
      ) : (
        multi.map(([grade, ts]) => {
          const cols = [...new Map(ts.map((t) => [t.sections!.framework_id, t])).values()];
          return (
            <section key={grade} className="mb-8">
              <h3 className="mb-3 font-display text-xl font-medium">Grade {grade}</h3>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                {cols.map((t) => {
                  const us = allUnits.filter((u) => u.grade === grade && u.framework_id === t.sections!.framework_id && (!t.subjects || u.subject_id === t.subjects.id));
                  return (
                    <div key={t.section_id} className="card-surface p-4">
                      <p className="font-mono text-xs text-primary">{t.sections!.frameworks?.code}</p>
                      <p className="font-medium">{t.sections!.frameworks?.name} · Section {t.sections!.section}</p>
                      <p className="mb-3 text-xs text-muted-foreground">{t.subjects?.name} · {us.length} units · {us.reduce((s, u) => s + Number(u.planned_hours ?? 0), 0)} h</p>
                      <ol className="flex flex-col gap-3">
                        {us.map((u) => (
                          <li key={u.id} className="rounded-lg border p-3">
                            <p className="text-sm font-medium">{u.sequence_no}. {u.title}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {u.unit_outcomes.map((uo) => uo.learning_outcomes && (
                                <OutcomeChip key={uo.learning_outcomes.id} size="sm" outcome={{ frameworkCode: uo.learning_outcomes.frameworks?.code ?? '', refCode: uo.learning_outcomes.ref_code, statement: uo.learning_outcomes.statement }} />
                              ))}
                            </div>
                          </li>
                        ))}
                        {us.length === 0 && <li className="text-sm text-muted-foreground">No units for this board yet.</li>}
                      </ol>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
