'use server';

import { revalidatePath } from 'next/cache';
import { logEvent } from '@/lib/audit';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { workerFetch } from '@/lib/worker';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('not authenticated');
  return user;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export async function runAlignmentEngine(useLlm: boolean) {
  const user = await requireUser();
  assert(can(user, 'approve', 'setu') || can(user, 'propose', 'setu'), 'not allowed');
  const stats = await workerFetch<Record<string, number>>('/setu/align', { schoolId: user.schoolId, json: { school_id: user.schoolId, use_llm: useLlm } });
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'align.run', entityType: 'setu', payload: stats });
  revalidatePath('/setu');
  revalidatePath('/setu/alignment');
  return stats;
}

export async function importOutcomes(formData: FormData) {
  const user = await requireUser();
  assert(can(user, 'edit', 'setu', { frameworkId: String(formData.get('framework_code') ?? '') || undefined }), 'not allowed');
  formData.set('school_id', user.schoolId);
  const result = await workerFetch<{ upserted: number; skipped: number; embedded: number }>('/setu/import', { schoolId: user.schoolId, formData });
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'outcomes.import', entityType: 'learning_outcome', payload: result });
  revalidatePath('/setu/outcomes');
  return result;
}

export async function confirmLink(outcomeId: string, conceptId: string) {
  const user = await requireUser();
  assert(can(user, 'approve', 'setu', { frameworkId: user.frameworkId, subjectId: user.subjectId }), 'only heads, coordinators and HODs confirm links');
  const supabase = await createClient();
  const { error } = await supabase
    .from('outcome_concepts')
    .update({ method: 'human_confirmed', confirmed_by: user.id, confirmed_at: new Date().toISOString() })
    .eq('learning_outcome_id', outcomeId)
    .eq('concept_id', conceptId);
  if (error) throw new Error(error.message);
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'alignment.confirm', entityType: 'outcome_concept', entityId: outcomeId, payload: { concept_id: conceptId } });
  revalidatePath('/setu/alignment');
}

export async function rejectLink(outcomeId: string, conceptId: string) {
  const user = await requireUser();
  assert(can(user, 'approve', 'setu', { frameworkId: user.frameworkId, subjectId: user.subjectId }), 'not allowed');
  const supabase = await createClient();
  const { error } = await supabase.from('outcome_concepts').delete().eq('learning_outcome_id', outcomeId).eq('concept_id', conceptId);
  if (error) throw new Error(error.message);
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'alignment.reject', entityType: 'outcome_concept', entityId: outcomeId, payload: { concept_id: conceptId } });
  revalidatePath('/setu/alignment');
}

export async function bulkConfirmLinks(pairs: { outcomeId: string; conceptId: string }[]) {
  for (const p of pairs) await confirmLink(p.outcomeId, p.conceptId);
}

export async function confirmCrossAlignment(outcomeA: string, outcomeB: string, relation: string, similarity: number | null) {
  const user = await requireUser();
  assert(can(user, 'approve', 'setu', { frameworkId: user.frameworkId, subjectId: user.subjectId }), 'not allowed');
  const supabase = await createClient();
  const { error } = await supabase.from('cross_alignments').upsert(
    { school_id: user.schoolId, outcome_a: outcomeA, outcome_b: outcomeB, relation, similarity, confirmed_by: user.id, confirmed_at: new Date().toISOString() },
    { onConflict: 'outcome_a,outcome_b' },
  );
  if (error) throw new Error(error.message);
  revalidatePath('/setu/alignment/cross');
}

export async function createConcept(input: { title: string; description?: string; subjectId: string | null; parentId: string | null; stage: string | null }) {
  const user = await requireUser();
  assert(can(user, 'edit', 'setu', { subjectId: input.subjectId, frameworkId: user.frameworkId }), 'not allowed');
  const supabase = await createClient();
  const { error } = await supabase.from('concepts').insert({
    school_id: user.schoolId, title: input.title, description: input.description || null,
    subject_id: input.subjectId, parent_id: input.parentId, stage: input.stage,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/setu/concepts');
}

export async function createUnit(input: { title: string; subjectId: string | null; grade: string; frameworkId: string; plannedHours: number | null; sequenceNo: number | null; academicYear: string }) {
  const user = await requireUser();
  assert(can(user, 'edit', 'setu', { frameworkId: input.frameworkId, subjectId: input.subjectId, teacherId: user.id }) || user.role === 'teacher', 'not allowed');
  const supabase = await createClient();
  const { data, error } = await supabase.from('units').insert({
    school_id: user.schoolId, title: input.title, subject_id: input.subjectId, grade: input.grade, framework_id: input.frameworkId,
    planned_hours: input.plannedHours, sequence_no: input.sequenceNo, academic_year: input.academicYear, created_by: user.id,
  }).select('id').single();
  if (error) throw new Error(error.message);
  revalidatePath('/setu/units');
  return data.id as string;
}

export async function attachOutcome(unitId: string, outcomeId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('unit_outcomes').upsert({ unit_id: unitId, learning_outcome_id: outcomeId });
  if (error) throw new Error(error.message);
  revalidatePath(`/setu/units/${unitId}`);
}

export async function detachOutcome(unitId: string, outcomeId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('unit_outcomes').delete().eq('unit_id', unitId).eq('learning_outcome_id', outcomeId);
  if (error) throw new Error(error.message);
  revalidatePath(`/setu/units/${unitId}`);
}

export async function markTaught(outcomeId: string, sectionId: string, academicYear: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('coverage').upsert(
    { school_id: user.schoolId, learning_outcome_id: outcomeId, section_id: sectionId, academic_year: academicYear, taught_on: new Date().toISOString().slice(0, 10) },
    { onConflict: 'learning_outcome_id,section_id,academic_year' },
  );
  if (error) throw new Error(error.message);
  revalidatePath('/setu/coverage');
}

export async function generateTransitionReport(studentId: string, toFrameworkCode: string, targetGrade: string) {
  const user = await requireUser();
  assert(can(user, 'view', 'setu'), 'not allowed');
  const row = await workerFetch<{ id: string }>('/setu/transition', {
    schoolId: user.schoolId,
    json: { school_id: user.schoolId, student_id: studentId, to_framework_code: toFrameworkCode, target_grade: targetGrade },
  });
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'transition.generate', entityType: 'transition_report', entityId: row.id });
  revalidatePath('/setu/transitions');
  return row.id;
}

export async function signedUrl(bucket: string, path: string) {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
