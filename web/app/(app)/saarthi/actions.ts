'use server';

import { revalidatePath } from 'next/cache';
import { approveArtifact as ledgerApprove, transitionArtifactStatus } from '@/lib/approval';
import { logEvent } from '@/lib/audit';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { workerFetch } from '@/lib/worker';

import { signedUrl as setuSignedUrl } from '../setu/actions';

export async function signedUrl(bucket: string, path: string) {
  return setuSignedUrl(bucket, path);
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('not authenticated');
  return user;
}
async function audit(user: Awaited<ReturnType<typeof requireUser>>, action: string, entityId?: string, payload?: Record<string, unknown>) {
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action, entityType: 'artifact', entityId, payload });
}

export async function recordGenerated(artifactId: string, kind: string) {
  const user = await requireUser();
  await audit(user, 'artifact.generate', artifactId, { kind });
  revalidatePath('/saarthi/history');
}

export async function saveArtifact(artifactId: string, body: unknown, title: string | null) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_artifact', { p_artifact_id: artifactId, p_body: body, p_title: title, p_editor: user.id });
  if (error) throw new Error(error.message);
  revalidatePath(`/saarthi/history/${artifactId}`);
  return data as number;
}

export async function approveArtifactAction(artifactId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: a } = await supabase.from('artifacts').select('created_by, subject_id, framework_id, generated_version, body').eq('id', artifactId).single();
  if (!a) throw new Error('artifact not found');
  const allowed = a.created_by === user.id || can(user, 'approve', 'saarthi', { subjectId: a.subject_id, frameworkId: a.framework_id, teacherId: a.created_by });
  if (!allowed) throw new Error('not allowed to approve this artifact');
  await ledgerApprove(supabase, { schoolId: user.schoolId, artifactType: 'artifact', artifactId, generatedVersion: a.generated_version ?? a.body, finalVersion: a.body, approvedBy: user.id });
  await transitionArtifactStatus(supabase, 'artifacts', artifactId, 'approved');
  await supabase.from('artifacts').update({ approved_by: user.id, approved_at: new Date().toISOString() }).eq('id', artifactId);
  await audit(user, 'artifact.approve', artifactId);
  revalidatePath(`/saarthi/history/${artifactId}`);
  revalidatePath('/saarthi/history');
}

export async function shareArtifact(artifactId: string, role: string, subjectId: string | null) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: a } = await supabase.from('artifacts').select('status').eq('id', artifactId).single();
  if (!a || (a.status !== 'approved' && a.status !== 'shared')) throw new Error('only approved artifacts can be shared');
  const { error } = await supabase.from('artifact_shares').upsert({ artifact_id: artifactId, shared_with_role: role, shared_with_subject: subjectId, shared_by: user.id }, { onConflict: 'artifact_id,shared_with_role' });
  if (error) throw new Error(error.message);
  await transitionArtifactStatus(supabase, 'artifacts', artifactId, 'shared');
  await audit(user, 'artifact.share', artifactId, { role, subject_id: subjectId });
  revalidatePath(`/saarthi/history/${artifactId}`);
}

export async function renderArtifactPdf(artifactId: string) {
  const user = await requireUser();
  const r = await workerFetch<{ file_path: string }>('/saarthi/pdf', { schoolId: user.schoolId, json: { school_id: user.schoolId, artifact_id: artifactId } });
  revalidatePath(`/saarthi/history/${artifactId}`);
  return r.file_path;
}

export async function buildRemediation(input: { sectionId: string; subjectId: string | null; generateForGaps: boolean; language: string }) {
  const user = await requireUser();
  const r = await workerFetch<{ artifact_id: string; weak: number; from_bank: number; generated: number; needs_generation: string[] }>('/saarthi/remediation', {
    schoolId: user.schoolId,
    json: { school_id: user.schoolId, actor_id: user.id, section_id: input.sectionId, subject_id: input.subjectId, generate_for_gaps: input.generateForGaps, language: input.language },
  });
  await audit(user, 'artifact.remediation', r.artifact_id, { weak: r.weak, from_bank: r.from_bank, generated: r.generated });
  revalidatePath('/saarthi/history');
  return r;
}
