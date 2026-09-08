import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import type { ConceptRow } from '@/lib/setu/types';
import { ConceptTree } from './concept-tree';
import { SETU_TABS } from '../nav';

export default async function ConceptsPage() {
  const supabase = await createClient();
  const [{ data: concepts }, { data: subjects }, { data: links }] = await Promise.all([
    supabase.from('concepts').select('id, title, description, stage, parent_id, subject_id').order('title'),
    supabase.from('subjects').select('id, name').order('name'),
    supabase.from('outcome_concepts').select('concept_id, method'),
  ]);

  const counts = new Map<string, { confirmed: number; pending: number }>();
  for (const l of links ?? []) {
    const c = counts.get(l.concept_id) ?? { confirmed: 0, pending: 0 };
    if (l.method === 'human_confirmed') c.confirmed++;
    else c.pending++;
    counts.set(l.concept_id, c);
  }

  return (
    <div>
      <PageHeader
        eyebrow="SETU"
        title="Concept graph"
        description="The canonical, board-agnostic nodes every framework's outcomes map onto. Parent → child hierarchy per subject."
        tabs={SETU_TABS}
        current="/setu/concepts"
      />
      <ConceptTree concepts={(concepts ?? []) as ConceptRow[]} subjects={subjects ?? []} counts={Object.fromEntries(counts)} />
    </div>
  );
}
