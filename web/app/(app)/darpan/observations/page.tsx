import { PageHeader } from '@/components/shared/page-header';
import { mySections } from '@/lib/darpan/sections';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { QuickCapture } from './capture';
import { SectionPicker } from '../section-picker';
import { CURRENT_TERM, DARPAN_TABS } from '../nav';

export default async function ObservationsPage({ searchParams }: { searchParams: Promise<{ section?: string; term?: string }> }) {
  const sp = await searchParams;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const sections = await mySections(supabase, user);
  const current = sections.find((s) => s.id === sp.section) ?? sections[0];
  if (!current) return <div><PageHeader eyebrow="DARPAN" title="Observations" tabs={DARPAN_TABS} current="/darpan/observations" /></div>;

  const [{ data: students }, { data: outcomes }, { data: recent }] = await Promise.all([
    supabase.from('students').select('id, full_name').eq('section_id', current.id).order('full_name'),
    supabase.from('learning_outcomes').select('id, ref_code').eq('grade', current.grade).order('ref_code').limit(60),
    supabase.from('observations').select('id, note, domain, context, observed_on, students(full_name)').order('observed_on', { ascending: false }).limit(12),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="DARPAN"
        title="Quick observation"
        description="Twenty seconds on a phone between periods. Things you deliberately noticed — never inferred by the system. Works offline; syncs when you are back online."
        tabs={DARPAN_TABS}
        current="/darpan/observations"
        actions={<SectionPicker sections={sections} current={current.id} term={sp.term ?? CURRENT_TERM} />}
      />
      <QuickCapture students={students ?? []} outcomes={outcomes ?? []} recent={(recent ?? []) as never} />
    </div>
  );
}
