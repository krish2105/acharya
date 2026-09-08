import { PageHeader } from '@/components/shared/page-header';
import { mySections } from '@/lib/darpan/sections';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { ReportsTable } from './table';
import { SectionPicker } from '../section-picker';
import { CURRENT_TERM, DARPAN_TABS } from '../nav';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ section?: string; term?: string }> }) {
  const sp = await searchParams;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const sections = await mySections(supabase, user);
  const current = sections.find((s) => s.id === sp.section) ?? sections[0];
  const term = sp.term ?? CURRENT_TERM;
  if (!current) return <div><PageHeader eyebrow="DARPAN" title="Reports" tabs={DARPAN_TABS} current="/darpan/reports" /></div>;
  const { data: completion } = await supabase.rpc('hpc_completion', { p_school_id: user.schoolId, p_section_id: current.id, p_term: term });
  const ids = ((completion ?? []) as { student_id: string }[]).map((r) => r.student_id);
  const { data: reports } = ids.length ? await supabase.from('hpc_reports').select('id, student_id, file_path, generated_at, released_to_parent_at').in('student_id', ids).eq('term', term) : { data: [] };
  return (
    <div>
      <PageHeader eyebrow="DARPAN" title="Reports" description="Stage-specific HPC PDFs. The database refuses to generate while any domain descriptor is unapproved. Release needs report_release consent on file." tabs={DARPAN_TABS} current="/darpan/reports" actions={<SectionPicker sections={sections} current={current.id} term={term} />} />
      <ReportsTable term={term} rows={(completion ?? []) as never} reports={(reports ?? []) as never} />
    </div>
  );
}
