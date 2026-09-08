import { EmptyState, PageHeader } from '@/components/shared/page-header';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import type { PendingLink } from '@/lib/setu/types';
import { AlignmentQueue } from './queue';
import { SETU_TABS } from '../nav';

export default async function AlignmentPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const { data } = await supabase
    .from('outcome_concepts')
    .select('learning_outcome_id, concept_id, confidence, method, justification, outcome:learning_outcomes(ref_code, statement, grade, frameworks(code)), concept:concepts(title, description)')
    .neq('method', 'human_confirmed')
    .order('confidence', { ascending: false })
    .limit(200);
  const items = (data ?? []) as unknown as PendingLink[];
  const canConfirm = can(user, 'approve', 'setu', { frameworkId: user.frameworkId, subjectId: user.subjectId });

  return (
    <div>
      <PageHeader
        eyebrow="SETU"
        title="Confirmation queue"
        description="Proposed outcome → concept links. J/K to move, A to confirm, R to reject, Space to select, Shift+A to confirm selected."
        tabs={SETU_TABS}
        current="/setu/alignment"
      />
      {items.length === 0 ? (
        <EmptyState title="Queue is clear" body="Run the alignment engine from the SETU overview to propose new links." />
      ) : (
        <AlignmentQueue items={items} canConfirm={canConfirm} />
      )}
    </div>
  );
}
