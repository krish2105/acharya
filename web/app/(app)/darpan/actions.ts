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
  if (!can(user, 'view', 'darpan', { isReportContent: true })) throw new Error('not allowed');
  return user;
}
async function audit(user: Awaited<ReturnType<typeof requireUser>>, action: string, entityType: string, entityId?: string, payload?: Record<string, unknown>) {
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action, entityType, entityId, payload });
}

export async function addObservation(input: { studentId: string; domain: string | null; context: string | null; note: string; outcomeId: string | null; observedOn?: string }) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from('observations').insert({
    school_id: user.schoolId, student_id: input.studentId, teacher_id: user.id, domain: input.domain, context: input.context,
    note: input.note.trim(), learning_outcome_id: input.outcomeId, observed_on: input.observedOn ?? new Date().toISOString().slice(0, 10),
  }).select('id').single();
  if (error) throw new Error(error.message);
  await audit(user, 'observation.create', 'observation', data.id as string);
  revalidatePath('/darpan/observations');
  return data.id as string;
}

export async function createParentToken(studentId: string, term: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: sg } = await supabase.from('student_guardians').select('guardian_id').eq('student_id', studentId).eq('is_primary', true).maybeSingle();
  if (!sg) throw new Error('no primary guardian on file');
  const { data, error } = await supabase.from('hpc_input_tokens').insert({ school_id: user.schoolId, student_id: studentId, guardian_id: sg.guardian_id, term }).select('token').single();
  if (error) throw new Error(error.message);
  await audit(user, 'hpc.parent_token', 'student', studentId, { term });
  return `/input/${data.token}`;
}

export async function submitTeacherInput(studentId: string, term: string, responses: Record<string, string>) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('hpc_inputs').insert({ school_id: user.schoolId, student_id: studentId, term, source: 'teacher', submitted_by: user.id, responses });
  if (error) throw new Error(error.message);
  revalidatePath('/darpan/inputs');
}

export async function draftDescriptor(studentId: string, term: string, domain: string, language: string) {
  const user = await requireUser();
  const r = await workerFetch<{ descriptor_id: string; text: string; redaction_count: number }>('/darpan/descriptor', {
    schoolId: user.schoolId, json: { school_id: user.schoolId, actor_id: user.id, student_id: studentId, term, domain, language },
  });
  await audit(user, 'descriptor.draft', 'hpc_descriptor', r.descriptor_id, { domain, redaction_count: r.redaction_count });
  revalidatePath(`/darpan/descriptors/${studentId}`);
  return r;
}

export async function saveDescriptor(descriptorId: string, finalText: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('hpc_descriptors').update({ final_text: finalText, updated_at: new Date().toISOString() }).eq('id', descriptorId);
  if (error) throw new Error(error.message);
}

export async function approveDescriptor(descriptorId: string, finalText: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: d } = await supabase.from('hpc_descriptors').select('student_id, generated_text').eq('id', descriptorId).single();
  if (!d) throw new Error('descriptor not found');
  await supabase.from('hpc_descriptors').update({ final_text: finalText }).eq('id', descriptorId);
  await ledgerApprove(supabase, { schoolId: user.schoolId, artifactType: 'descriptor', artifactId: descriptorId, generatedVersion: d.generated_text ?? '', finalVersion: finalText, approvedBy: user.id });
  await transitionArtifactStatus(supabase, 'hpc_descriptors', descriptorId, 'approved');
  await supabase.from('hpc_descriptors').update({ approved_by: user.id, approved_at: new Date().toISOString() }).eq('id', descriptorId);
  await audit(user, 'descriptor.approve', 'hpc_descriptor', descriptorId);
  revalidatePath(`/darpan/descriptors/${d.student_id}`);
  revalidatePath('/darpan');
}

export async function generateReport(studentId: string, term: string) {
  const user = await requireUser();
  const r = await workerFetch<{ report_id: string; file_path: string }>('/darpan/report', { schoolId: user.schoolId, json: { school_id: user.schoolId, actor_id: user.id, student_id: studentId, term } });
  await audit(user, 'hpc_report.generate', 'hpc_report', r.report_id);
  revalidatePath('/darpan/reports');
  return r;
}

export async function releaseReport(reportId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: r } = await supabase.from('hpc_reports').select('student_id, generated_at').eq('id', reportId).single();
  if (!r?.generated_at) throw new Error('generate the report first');
  const { data: consent } = await supabase.rpc('has_consent', { p_student_id: r.student_id, p_purpose: 'report_release' });
  if (!consent) throw new Error('no report_release consent on file for this child');
  const { error } = await supabase.from('hpc_reports').update({ released_to_parent_at: new Date().toISOString(), released_by: user.id }).eq('id', reportId);
  if (error) throw new Error(error.message);
  await audit(user, 'hpc_report.release', 'hpc_report', reportId);
  revalidatePath('/darpan/reports');
}
