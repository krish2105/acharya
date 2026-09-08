import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { BlueprintBuilder } from './builder';
import { PRASHNA_TABS } from '../nav';

export default async function BlueprintsPage() {
  const supabase = await createClient();
  const [{ data: blueprints }, { data: frameworks }, { data: subjects }] = await Promise.all([
    supabase.from('blueprints').select('id, label, grade, total_marks, duration_minutes, composition, framework_id, subject_id, is_active, frameworks(code), subjects(name)').order('label'),
    supabase.from('school_frameworks').select('frameworks(id, code)'),
    supabase.from('subjects').select('id, name').order('name'),
  ]);
  return (
    <div>
      <PageHeader
        eyebrow="PRASHNA"
        title="Blueprints"
        description="The paper design rules per framework: sections, marks, competency percentage, Bloom mix. CBSE 2026, IGCSE, MYP and AP patterns are seeded."
        tabs={PRASHNA_TABS}
        current="/prashna/blueprints"
      />
      <BlueprintBuilder blueprints={(blueprints ?? []) as never} frameworks={(frameworks ?? []).map((f) => f.frameworks as unknown as { id: string; code: string }).filter(Boolean)} subjects={subjects ?? []} />
    </div>
  );
}
