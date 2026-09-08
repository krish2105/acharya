'use server';

import { revalidatePath } from 'next/cache';
import { logEvent } from '@/lib/audit';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function addExamEvent(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !['principal', 'academic_head', 'exam_officer'].includes(user.role)) throw new Error('not allowed');
  const supabase = await createClient();
  const row = {
    school_id: user.schoolId,
    title: String(formData.get('title') ?? '').trim(),
    kind: String(formData.get('kind') ?? 'internal'),
    grade: String(formData.get('grade') ?? '') || null,
    starts_on: String(formData.get('starts_on') ?? ''),
    ends_on: String(formData.get('ends_on') ?? '') || null,
    note: String(formData.get('note') ?? '') || null,
  };
  if (!row.title || !row.starts_on) throw new Error('title and start date are required');
  const { data, error } = await supabase.from('exam_events').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  await logEvent(createServiceClient(), { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action: 'exam_event.create', entityType: 'exam_event', entityId: data.id, payload: { kind: row.kind, grade: row.grade } });
  revalidatePath('/exams');
}
