import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { ArtifactView } from './artifact-view';
import { KIND_LABEL, SAARTHI_TABS } from '../../nav';

export default async function ArtifactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const [{ data: a }, { data: versions }, { data: subjects }] = await Promise.all([
    supabase.from('artifacts').select('*, subjects(name), frameworks(code), students(full_name), artifact_outcomes(learning_outcomes(ref_code, statement, frameworks(code))), artifact_shares(shared_with_role, shared_with_subject, shared_at), approvals:approvals!approvals_artifact_id_fkey(edit_distance, approved_at)').eq('id', id).maybeSingle(),
    supabase.from('artifact_versions').select('version, body, edited_at').eq('artifact_id', id).order('version'),
    supabase.from('subjects').select('id, name').order('name'),
  ]);
  if (!a) notFound();
  const canApprove = a.created_by === user.id || can(user, 'approve', 'saarthi', { subjectId: a.subject_id, frameworkId: a.framework_id, teacherId: a.created_by });
  const canEdit = a.created_by === user.id || can(user, 'edit', 'saarthi', { subjectId: a.subject_id, frameworkId: a.framework_id, teacherId: a.created_by });

  return (
    <div>
      <PageHeader eyebrow={`SAARTHI · ${KIND_LABEL[a.kind as keyof typeof KIND_LABEL]}`} title={a.title} tabs={SAARTHI_TABS} current="/saarthi/history" />
      <ArtifactView artifact={a as never} versions={(versions ?? []) as never} subjects={subjects ?? []} canApprove={canApprove} canEdit={canEdit && a.status === 'draft'} />
    </div>
  );
}
