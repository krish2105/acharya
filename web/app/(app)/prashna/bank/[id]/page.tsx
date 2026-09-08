import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { ItemEditor } from './item-editor';
import { PRASHNA_TABS } from '../../nav';

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  const { q } = await searchParams;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const isNew = id === 'new';

  const [{ data: frameworks }, { data: subjects }] = await Promise.all([
    supabase.from('school_frameworks').select('frameworks(id, code)'),
    supabase.from('subjects').select('id, name').order('name'),
  ]);

  let item = null;
  let versions: { version: number; body: Record<string, unknown>; edited_at: string }[] = [];
  if (!isNew) {
    const { data } = await supabase
      .from('items')
      .select('*, item_outcomes(learning_outcomes(id, ref_code, statement, frameworks(code))), approvals:approvals!approvals_artifact_id_fkey(edit_distance)')
      .eq('id', id)
      .maybeSingle();
    if (!data) notFound();
    item = data;
    const { data: v } = await supabase.from('item_versions').select('version, body, edited_at').eq('item_id', id).order('version');
    versions = (v ?? []) as never;
  }

  let search = supabase.from('learning_outcomes').select('id, ref_code, statement, grade, frameworks(code)').order('ref_code').limit(12);
  if (q) search = search.or(`statement.ilike.%${q}%,ref_code.ilike.%${q}%`);
  else if (item) search = search.eq('grade', item.grade).eq('subject_id', item.subject_id);
  else search = search.eq('grade', '10');
  const { data: candidates } = await search;

  const canApprove = item ? can(user, 'approve', 'prashna', { subjectId: item.subject_id, frameworkId: item.framework_id }) : false;

  return (
    <div>
      <PageHeader eyebrow="PRASHNA" title={isNew ? 'Write an item' : 'Edit item'} tabs={PRASHNA_TABS} current="/prashna/bank" />
      <ItemEditor
        item={item as never}
        versions={versions as never}
        candidates={(candidates ?? []) as never}
        frameworks={(frameworks ?? []).map((f) => f.frameworks as unknown as { id: string; code: string }).filter(Boolean)}
        subjects={subjects ?? []}
        canApprove={canApprove}
        isOwner={item ? item.created_by === user.id : true}
        q={q ?? ''}
      />
    </div>
  );
}
