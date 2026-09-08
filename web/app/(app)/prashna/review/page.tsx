import { EmptyState, PageHeader } from '@/components/shared/page-header';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { ReviewQueue } from './review-queue';
import { PRASHNA_TABS } from '../nav';

export default async function ReviewPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  let q = supabase
    .from('items')
    .select('id, stem, item_type, marks, cognitive_level, difficulty_intended, subject_id, framework_id, grade, created_by, subjects(name), frameworks(code), profiles!items_created_by_fkey(full_name), item_outcomes(learning_outcomes(ref_code, statement, frameworks(code))), item_versions(version, body)')
    .eq('status', 'pending_review')
    .order('updated_at')
    .limit(100);
  if (user.role === 'hod' && user.subjectId) q = q.eq('subject_id', user.subjectId);
  const { data } = await q;
  const items = ((data ?? []) as never as { subject_id: string; framework_id: string }[]).filter((i) => can(user, 'approve', 'prashna', { subjectId: i.subject_id, frameworkId: i.framework_id }));

  return (
    <div>
      <PageHeader
        eyebrow="PRASHNA"
        title="HOD review queue"
        description="Items submitted by teachers. Approve (A) into the shared bank, request changes (C), or reject (R). Generated vs edited shown side by side."
        tabs={PRASHNA_TABS}
        current="/prashna/review"
      />
      {items.length === 0 ? <EmptyState title="Nothing to review" body="Items you can approve will appear here once teachers submit them." /> : <ReviewQueue items={items as never} />}
    </div>
  );
}
