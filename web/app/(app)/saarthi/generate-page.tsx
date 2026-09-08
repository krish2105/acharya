import { PageHeader } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { GenerateForm } from './generate-form';
import { KIND_LABEL, SAARTHI_TABS, type Kind } from './nav';

const DESCRIPTIONS: Record<Kind, string> = {
  lesson_plan: 'Objectives, hook, sequence, checks for understanding, differentiation, closure and homework — for a unit you already teach.',
  worksheet: 'The same outcome at support, core and extension levels, with an answer key. Hindi output supported.',
  rubric: 'Descriptor bands from an outcome and your task description.',
  parent_message: 'Drafted from your notes. Names are redacted before the model sees anything and restored afterwards. Diagnostic or comparative language is rejected automatically.',
  activity: 'A low-resource classroom activity with an assessment note.',
  remediation_set: 'Practice for weak outcomes, from the approved bank first.',
  revision_sheet: 'Key points, common errors and practice ahead of an exam.',
};

export async function GeneratePage({ kind, current, searchParams }: { kind: Kind; current: string; searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();

  let sectionsQ = supabase.from('sections').select('id, grade, section').order('grade');
  if (user.role === 'teacher') {
    const { data: tas } = await supabase.from('teaching_assignments').select('section_id').eq('teacher_id', user.id);
    sectionsQ = sectionsQ.in('id', (tas ?? []).map((t) => t.section_id));
  }
  const [{ data: units }, { data: sections }] = await Promise.all([
    supabase.from('units').select('id, title, grade, frameworks(code), subjects(name)').order('grade').order('sequence_no'),
    sectionsQ,
  ]);
  const sectionIds = (sections ?? []).map((s) => s.id);
  let oq = supabase.from('learning_outcomes').select('id, ref_code, statement, grade, frameworks(code)').order('ref_code').limit(40);
  oq = q ? oq.or(`statement.ilike.%${q}%,ref_code.ilike.%${q}%`) : oq.ilike('ref_code', 'CBSE.%');
  const [{ data: outcomes }, { data: students }] = await Promise.all([
    oq,
    kind === 'parent_message' && sectionIds.length ? supabase.from('students').select('id, full_name, admission_no').in('section_id', sectionIds).order('full_name') : Promise.resolve({ data: [] as { id: string; full_name: string; admission_no: string }[] }),
  ]);

  return (
    <div>
      <PageHeader eyebrow="SAARTHI · charioteer" title={KIND_LABEL[kind]} description={DESCRIPTIONS[kind]} tabs={SAARTHI_TABS} current={current} />
      <GenerateForm kind={kind} units={(units ?? []) as never} outcomes={(outcomes ?? []) as never} sections={sections ?? []} students={(students ?? []) as never} q={q ?? ''} />
    </div>
  );
}
