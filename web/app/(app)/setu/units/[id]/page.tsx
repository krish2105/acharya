import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { UnitOutcomesEditor } from './editor';
import { SETU_TABS } from '../../nav';

export default async function UnitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: unit } = await supabase
    .from('units')
    .select('id, title, grade, planned_hours, sequence_no, academic_year, framework_id, subject_id, frameworks(code), subjects(name), unit_outcomes(learning_outcomes(id, ref_code, statement, grade, frameworks(code)))')
    .eq('id', id)
    .maybeSingle();
  if (!unit) notFound();

  let search = supabase.from('learning_outcomes').select('id, ref_code, statement, grade, frameworks(code)').order('ref_code').limit(15);
  if (q) search = search.or(`statement.ilike.%${q}%,ref_code.ilike.%${q}%`);
  else search = search.eq('grade', unit.grade);
  if (unit.subject_id && !q) search = search.eq('subject_id', unit.subject_id);
  const { data: candidates } = await search;

  const attached = unit.unit_outcomes.map((uo) => uo.learning_outcomes).filter(Boolean) as unknown as { id: string; ref_code: string; statement: string; grade: string; frameworks: { code: string } | null }[];

  return (
    <div>
      <PageHeader
        eyebrow={`SETU · Unit ${unit.sequence_no ?? ''} · Grade ${unit.grade} ${(unit.frameworks as unknown as { code: string } | null)?.code ?? ''}`}
        title={unit.title}
        description={`${(unit.subjects as unknown as { name: string } | null)?.name ?? ''} · ${unit.planned_hours ?? '—'} planned hours · ${unit.academic_year}`}
        tabs={SETU_TABS}
        current="/setu/units"
      />
      <UnitOutcomesEditor unitId={unit.id} attached={attached} candidates={((candidates ?? []) as never) ?? []} q={q ?? ''} />
    </div>
  );
}
