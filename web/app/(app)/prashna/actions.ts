'use server';

import { revalidatePath } from 'next/cache';
import { approveArtifact, transitionArtifactStatus } from '@/lib/approval';
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
const assert = (c: boolean, m: string) => {
  if (!c) throw new Error(m);
};
async function audit(user: Awaited<ReturnType<typeof requireUser>>, action: string, entityType: string, entityId?: string, payload?: Record<string, unknown>) {
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action, entityType, entityId, payload });
}

export async function generateItems(input: { subjectId: string; grade: string; frameworkId: string; outcomeIds: string[]; itemType: string; count: number; bloom: string; chapterText?: string }) {
  const user = await requireUser();
  assert(can(user, 'create', 'prashna', { teacherId: user.id, subjectId: user.subjectId, frameworkId: user.frameworkId }), 'not allowed');
  const result = await workerFetch<{ item_ids: string[]; count: number }>('/prashna/generate', {
    schoolId: user.schoolId,
    json: { school_id: user.schoolId, actor_id: user.id, subject_id: input.subjectId, grade: input.grade, framework_id: input.frameworkId, outcome_ids: input.outcomeIds, item_type: input.itemType, count: input.count, bloom: input.bloom, chapter_text: input.chapterText || null },
  });
  await audit(user, 'item.generate', 'item', undefined, { count: result.count, item_type: input.itemType });
  revalidatePath('/prashna/bank');
  return result;
}

export async function saveItem(itemId: string, patch: Record<string, unknown>, outcomeIds: string[]) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_item', { p_item_id: itemId, p_patch: patch, p_outcome_ids: outcomeIds, p_editor: user.id });
  if (error) throw new Error(error.message);
  revalidatePath(`/prashna/bank/${itemId}`);
  return data as number;
}

export async function createItem(item: Record<string, unknown>, outcomeIds: string[]) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_item', { p_item: { ...item, school_id: user.schoolId, created_by: user.id, origin: 'teacher_written', status: 'draft' }, p_outcome_ids: outcomeIds });
  if (error) throw new Error(error.message);
  await audit(user, 'item.create', 'item', data as string);
  revalidatePath('/prashna/bank');
  return data as string;
}

export async function submitForReview(itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('items').update({ status: 'pending_review', review_note: null }).eq('id', itemId);
  if (error) throw new Error(error.message);
  await audit(user, 'item.submit', 'item', itemId);
  revalidatePath('/prashna/bank');
  revalidatePath('/prashna/review');
}

export async function approveItem(itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: item } = await supabase.from('items').select('subject_id, framework_id').eq('id', itemId).single();
  assert(!!item && can(user, 'approve', 'prashna', { subjectId: item.subject_id, frameworkId: item.framework_id }), 'only the HOD for this subject (or a head) can approve');
  const { data: versions } = await supabase.from('item_versions').select('version, body').eq('item_id', itemId).order('version');
  const first = versions?.[0]?.body ?? {};
  const last = versions?.[versions.length - 1]?.body ?? first;
  await approveArtifact(supabase, { schoolId: user.schoolId, artifactType: 'item', artifactId: itemId, generatedVersion: first, finalVersion: last, approvedBy: user.id });
  await transitionArtifactStatus(supabase, 'items', itemId, 'approved');
  await supabase.from('items').update({ approved_by: user.id, approved_at: new Date().toISOString() }).eq('id', itemId);
  await audit(user, 'item.approve', 'item', itemId);
  revalidatePath('/prashna/review');
  revalidatePath('/prashna/bank');
}

export async function requestChanges(itemId: string, note: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('items').update({ status: 'draft', review_note: note }).eq('id', itemId);
  if (error) throw new Error(error.message);
  await audit(user, 'item.request_changes', 'item', itemId, { note });
  revalidatePath('/prashna/review');
}

export async function rejectItem(itemId: string, note: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('items').update({ status: 'retired', review_note: note }).eq('id', itemId);
  if (error) throw new Error(error.message);
  await audit(user, 'item.reject', 'item', itemId, { note });
  revalidatePath('/prashna/review');
}

export async function saveBlueprint(input: { id?: string; frameworkId: string; subjectId: string; grade: string; label: string; totalMarks: number; durationMinutes: number; composition: unknown }) {
  const user = await requireUser();
  assert(can(user, 'edit', 'prashna', { frameworkId: input.frameworkId, subjectId: input.subjectId }) || user.role === 'exam_officer', 'not allowed');
  const supabase = await createClient();
  const row = { school_id: user.schoolId, framework_id: input.frameworkId, subject_id: input.subjectId, grade: input.grade, label: input.label, total_marks: input.totalMarks, duration_minutes: input.durationMinutes, composition: input.composition };
  const { error } = input.id ? await supabase.from('blueprints').update(row).eq('id', input.id) : await supabase.from('blueprints').insert(row);
  if (error) throw new Error(error.message);
  revalidatePath('/prashna/blueprints');
}

export async function assemblePaper(input: { blueprintId: string; sectionId: string | null; title: string; examKind: string; scheduledOn: string | null }) {
  const user = await requireUser();
  const result = await workerFetch<{ paper_id: string; shortfalls: unknown[] }>('/prashna/assemble', {
    schoolId: user.schoolId,
    json: { school_id: user.schoolId, actor_id: user.id, blueprint_id: input.blueprintId, section_id: input.sectionId, title: input.title, exam_kind: input.examKind, scheduled_on: input.scheduledOn },
  });
  await audit(user, 'paper.assemble', 'paper', result.paper_id, { shortfalls: result.shortfalls.length });
  revalidatePath('/prashna/papers');
  return result.paper_id;
}

export async function createImprovementPaper(mainPaperId: string) {
  const user = await requireUser();
  const result = await workerFetch<{ paper_id: string }>('/prashna/improvement', { schoolId: user.schoolId, json: { school_id: user.schoolId, actor_id: user.id, main_paper_id: mainPaperId } });
  await audit(user, 'paper.improvement', 'paper', result.paper_id, { main: mainPaperId });
  revalidatePath('/prashna/papers');
  return result.paper_id;
}

export async function renderPaperPdfs(paperId: string) {
  const user = await requireUser();
  const files = await workerFetch<Record<string, string>>('/prashna/pdf', { schoolId: user.schoolId, json: { school_id: user.schoolId, paper_id: paperId } });
  revalidatePath(`/prashna/papers/${paperId}`);
  return files;
}

export async function approvePaper(paperId: string) {
  const user = await requireUser();
  assert(can(user, 'approve', 'prashna', { subjectId: user.subjectId, frameworkId: user.frameworkId }) || user.role === 'exam_officer', 'not allowed');
  const supabase = await createClient();
  const { data: paper } = await supabase.from('papers').select('compliance, shortfalls').eq('id', paperId).single();
  await approveArtifact(supabase, { schoolId: user.schoolId, artifactType: 'paper', artifactId: paperId, generatedVersion: paper?.compliance ?? {}, finalVersion: paper?.compliance ?? {}, approvedBy: user.id });
  await transitionArtifactStatus(supabase, 'papers', paperId, 'approved');
  await supabase.from('papers').update({ approved_by: user.id, approved_at: new Date().toISOString() }).eq('id', paperId);
  await audit(user, 'paper.approve', 'paper', paperId);
  revalidatePath(`/prashna/papers/${paperId}`);
}

export async function importMarks(formData: FormData) {
  const user = await requireUser();
  formData.set('school_id', user.schoolId);
  const result = await workerFetch<{ imported: number; skipped: number; calibrated: number }>('/prashna/marks', { schoolId: user.schoolId, formData });
  await audit(user, 'marks.import', 'paper', String(formData.get('paper_id')), result as unknown as Record<string, unknown>);
  revalidatePath('/prashna/calibration');
  return result;
}

export async function runCalibration() {
  const user = await requireUser();
  const result = await workerFetch<{ items: number }>('/prashna/calibrate', { schoolId: user.schoolId, json: { school_id: user.schoolId } });
  await audit(user, 'calibration.run', 'item_stats', undefined, result as unknown as Record<string, unknown>);
  revalidatePath('/prashna/calibration');
  return result;
}
