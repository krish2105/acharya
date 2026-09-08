'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';

async function me() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') throw new Error('not allowed');
  const supabase = await createClient();
  const { data } = await supabase.from('students').select('id').eq('auth_user_id', user.id).maybeSingle();
  if (!data) throw new Error('no student record linked to this account');
  return { user, supabase, studentId: data.id as string };
}

export async function submitSelfInput(term: string, responses: Record<string, string>, language: string) {
  const { user, supabase, studentId } = await me();
  const { error } = await supabase.from('hpc_inputs').insert({ school_id: user.schoolId, student_id: studentId, term, source: 'self', submitted_by_student: studentId, responses, language });
  if (error) throw new Error(error.message);
  revalidatePath('/student');
}

export async function submitPeerInput(aboutStudentId: string, term: string, responses: Record<string, string>, language: string) {
  const { user, supabase, studentId } = await me();
  if (aboutStudentId === studentId) throw new Error('pick a classmate, not yourself');
  // submitted_by stays null: the receiving student never sees the author (RLS + view); the teacher sees submitted_by_student.
  const { error } = await supabase.from('hpc_inputs').insert({ school_id: user.schoolId, student_id: aboutStudentId, term, source: 'peer', submitted_by: null, submitted_by_student: studentId, responses, language });
  if (error) throw new Error(error.message);
  revalidatePath('/student');
}

export async function uploadProject(formData: FormData) {
  const { user, supabase, studentId } = await me();
  const file = formData.get('artefact');
  if (!(file instanceof File) || file.size === 0) throw new Error('choose a file');
  if (file.size > 20 * 1024 * 1024) throw new Error('file too large (20 MB max)');
  const path = `${user.schoolId}/projects/${studentId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: upErr } = await supabase.storage.from('projects').upload(path, file, { contentType: file.type });
  if (upErr) throw new Error(upErr.message);
  const { error } = await supabase.from('ct_ai_projects').insert({ school_id: user.schoolId, student_id: studentId, unit_id: String(formData.get('unit_id') || '') || null, title: String(formData.get('title')), artefact_path: path, submitted_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath('/student');
}
