import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { GenerateForm } from './generate-form';
import { PRASHNA_TABS } from '../nav';

export default async function GeneratePage({ searchParams }: { searchParams: Promise<{ framework?: string; subject?: string; grade?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: frameworks }, { data: subjects }] = await Promise.all([
    supabase.from('school_frameworks').select('frameworks(id, code, name)'),
    supabase.from('subjects').select('id, name').order('name'),
  ]);
  const fws = (frameworks ?? []).map((f) => f.frameworks as unknown as { id: string; code: string; name: string }).filter(Boolean);
  const framework = sp.framework ?? fws.find((f) => f.code === 'CBSE')?.id ?? fws[0]?.id;
  const subject = sp.subject ?? subjects?.[0]?.id;
  const grade = sp.grade ?? '10';

  const { data: outcomes } = await supabase
    .from('learning_outcomes')
    .select('id, ref_code, statement, frameworks(code)')
    .eq('framework_id', framework!)
    .eq('subject_id', subject!)
    .eq('grade', grade)
    .order('ref_code');

  return (
    <div>
      <PageHeader
        eyebrow="PRASHNA"
        title="Generate items"
        description="Always from outcomes, never from a blank box. Output is schema-validated and lands as private drafts for you to edit before HOD review."
        tabs={PRASHNA_TABS}
        current="/prashna/generate"
      />
      <GenerateForm frameworks={fws} subjects={subjects ?? []} selection={{ framework: framework!, subject: subject!, grade }} outcomes={(outcomes ?? []) as never} />
    </div>
  );
}
