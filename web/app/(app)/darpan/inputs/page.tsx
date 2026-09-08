import { PageHeader } from '@/components/shared/page-header';
import { mySections } from '@/lib/darpan/sections';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { InputsMatrix } from './matrix';
import { SectionPicker } from '../section-picker';
import { CURRENT_TERM, DARPAN_TABS } from '../nav';

export default async function InputsPage({ searchParams }: { searchParams: Promise<{ section?: string; term?: string }> }) {
  const sp = await searchParams;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const sections = await mySections(supabase, user);
  const current = sections.find((s) => s.id === sp.section) ?? sections[0];
  const term = sp.term ?? CURRENT_TERM;
  if (!current) return <div><PageHeader eyebrow="DARPAN" title="360° inputs" tabs={DARPAN_TABS} current="/darpan/inputs" /></div>;
  const { data: students } = await supabase.from('students').select('id, full_name').eq('section_id', current.id).order('full_name');
  const ids = (students ?? []).map((s) => s.id);
  const [{ data: inputs }, { data: consents }] = await Promise.all([
    ids.length ? supabase.from('hpc_inputs').select('student_id, source').in('student_id', ids).eq('term', term) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('consent_records').select('student_id, purpose, granted, withdrawn_at').in('student_id', ids) : Promise.resolve({ data: [] }),
  ]);
  return (
    <div>
      <PageHeader
        eyebrow="DARPAN"
        title="360° inputs"
        description="Self-assessment (student portal), anonymised peer input, a tokenised parent link (no login, bilingual), and your own input. Parent input needs parent_input consent on file."
        tabs={DARPAN_TABS}
        current="/darpan/inputs"
        actions={<SectionPicker sections={sections} current={current.id} term={term} />}
      />
      <InputsMatrix term={term} students={students ?? []} inputs={(inputs ?? []) as { student_id: string; source: string }[]} consents={(consents ?? []) as { student_id: string; purpose: string; granted: boolean; withdrawn_at: string | null }[]} />
    </div>
  );
}
