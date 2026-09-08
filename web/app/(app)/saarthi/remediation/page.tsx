import { PageHeader } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { RemediationForm } from './form';
import { SAARTHI_TABS } from '../nav';

export default async function RemediationPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  let sectionsQ = supabase.from('sections').select('id, grade, section, frameworks(code)').order('grade');
  if (user.role === 'teacher') {
    const { data: tas } = await supabase.from('teaching_assignments').select('section_id').eq('teacher_id', user.id);
    sectionsQ = sectionsQ.in('id', (tas ?? []).map((t) => t.section_id));
  }
  const [{ data: sections }, { data: subjects }] = await Promise.all([sectionsQ, supabase.from('subjects').select('id, name').order('name')]);
  return (
    <div>
      <PageHeader
        eyebrow="SAARTHI"
        title="Remediation set"
        description="Finds the outcomes a class scored below 50% on, builds practice from the approved item bank first, and generates only for outcomes with an empty bank."
        tabs={SAARTHI_TABS}
        current="/saarthi/remediation"
      />
      <RemediationForm sections={(sections ?? []).map((s) => ({ id: s.id, label: `Grade ${s.grade}${s.section} · ${(s.frameworks as unknown as { code: string } | null)?.code ?? ''}` }))} subjects={subjects ?? []} />
    </div>
  );
}
