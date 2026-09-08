'use server';

import { revalidatePath } from 'next/cache';
import { logEvent } from '@/lib/audit';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { workerFetch } from '@/lib/worker';
import { signedUrl as setuSignedUrl } from '../setu/actions';
import { YEAR } from './nav';

export async function signedUrl(bucket: string, path: string) {
  return setuSignedUrl(bucket, path);
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user || !can(user, 'view', 'uday')) throw new Error('not allowed');
  return user;
}
async function audit(user: Awaited<ReturnType<typeof requireUser>>, action: string, entityType: string, entityId?: string, payload?: Record<string, unknown>) {
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action, entityType, entityId, payload });
}

export async function logHours(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const sectionId = String(formData.get('section_id'));
  let evidencePath: string | null = null;
  const file = formData.get('evidence');
  if (file instanceof File && file.size > 0) {
    const path = `${user.schoolId}/uday/${sectionId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('evidence').upload(path, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    evidencePath = path;
  }
  const { data, error } = await supabase.from('ct_ai_hours_ledger').insert({
    school_id: user.schoolId, section_id: sectionId, academic_year: YEAR, activity_id: String(formData.get('activity_id') || '') || null,
    delivered_on: String(formData.get('delivered_on')), minutes: Number(formData.get('minutes')), teacher_id: user.id, evidence_path: evidencePath, note: String(formData.get('note') ?? '') || null,
  }).select('id').single();
  if (error) throw new Error(error.message);
  await audit(user, 'uday.hours.log', 'ct_ai_hours_ledger', data.id as string, { minutes: Number(formData.get('minutes')) });
  revalidatePath('/uday');
  revalidatePath('/uday/hours');
}

export async function assessProject(projectId: string, scores: Record<string, number>, comment: string) {
  const user = await requireUser();
  const supabase = await createClient();
  // A teacher enters every score; nothing here is inferred (rule 2.1.1).
  const { error } = await supabase.from('ct_ai_projects').update({ rubric_scores: scores, teacher_comment: comment, assessed_by: user.id, assessed_on: new Date().toISOString().slice(0, 10) }).eq('id', projectId);
  if (error) throw new Error(error.message);
  await audit(user, 'uday.project.assess', 'ct_ai_project', projectId);
  revalidatePath('/uday/projects');
}

export async function addCpd(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  let certPath: string | null = null;
  const file = formData.get('certificate');
  const teacherId = String(formData.get('teacher_id') || user.id);
  if (file instanceof File && file.size > 0) {
    const path = `${user.schoolId}/cpd/${teacherId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('cpd').upload(path, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    certPath = path;
  }
  const { error } = await supabase.from('cpd_records').insert({ school_id: user.schoolId, teacher_id: teacherId, activity: String(formData.get('activity')), hours: Number(formData.get('hours')), completed_on: String(formData.get('completed_on') || '') || null, certificate_path: certPath });
  if (error) throw new Error(error.message);
  revalidatePath('/uday/cpd');
}

export async function renderEvidencePack(grade: string) {
  const user = await requireUser();
  const r = await workerFetch<{ file_path: string; sections: string[] }>('/uday/evidence-pack', { schoolId: user.schoolId, json: { school_id: user.schoolId, grade, academic_year: YEAR } });
  await audit(user, 'uday.evidence_pack', 'uday', undefined, { grade });
  return r.file_path;
}
