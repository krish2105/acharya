import { OutcomeChip } from '@/components/shared/outcome-chip';
import { PageHeader } from '@/components/shared/page-header';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { CrossAlignmentView } from './view';
import { SETU_TABS } from '../../nav';

export default async function CrossAlignmentPage({ searchParams }: { searchParams: Promise<{ outcome?: string; q?: string }> }) {
  const sp = await searchParams;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();

  const { data: candidates } = await supabase
    .from('learning_outcomes')
    .select('id, ref_code, statement, grade, frameworks(code)')
    .or(sp.q ? `statement.ilike.%${sp.q}%,ref_code.ilike.%${sp.q}%` : 'ref_code.ilike.CBSE.SCI.9%')
    .order('ref_code')
    .limit(12);

  let source = null;
  let similar: unknown[] = [];
  let confirmed: unknown[] = [];
  if (sp.outcome) {
    const [{ data: src }, { data: sim }, { data: conf }] = await Promise.all([
      supabase.from('learning_outcomes').select('id, ref_code, statement, grade, frameworks(code)').eq('id', sp.outcome).maybeSingle(),
      supabase.rpc('similar_outcomes', { p_outcome_id: sp.outcome, p_k: 8 }),
      supabase
        .from('cross_alignments')
        .select('outcome_a, outcome_b, relation, similarity, a:learning_outcomes!cross_alignments_outcome_a_fkey(ref_code, statement, frameworks(code)), b:learning_outcomes!cross_alignments_outcome_b_fkey(ref_code, statement, frameworks(code))')
        .or(`outcome_a.eq.${sp.outcome},outcome_b.eq.${sp.outcome}`)
        .not('confirmed_at', 'is', null),
    ]);
    source = src;
    similar = sim ?? [];
    confirmed = conf ?? [];
  }

  return (
    <div>
      <PageHeader
        eyebrow="SETU"
        title="Cross-framework equivalents"
        description="Pick any outcome and see its nearest equivalents in the other boards. Confirm a relation to record it."
        tabs={SETU_TABS}
        current="/setu/alignment/cross"
      />
      <CrossAlignmentView
        q={sp.q ?? ''}
        candidates={(candidates ?? []) as never}
        source={source as never}
        similar={similar as never}
        confirmed={confirmed as never}
        canConfirm={can(user, 'approve', 'setu', { frameworkId: user.frameworkId, subjectId: user.subjectId })}
      />
      {source && (
        <p className="sr-only">
          Source: <OutcomeChip outcome={{ frameworkCode: '', refCode: (source as { ref_code: string }).ref_code, statement: '' }} />
        </p>
      )}
    </div>
  );
}
