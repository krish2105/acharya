import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentUser } from '@/lib/supabase/current-user';

export async function mySections(supabase: SupabaseClient, user: CurrentUser) {
  let q = supabase.from('sections').select('id, grade, section, frameworks(code)').order('grade').order('section');
  if (user.role === 'teacher') {
    const { data: tas } = await supabase.from('teaching_assignments').select('section_id').eq('teacher_id', user.id);
    q = q.in('id', (tas ?? []).map((t) => t.section_id));
  }
  const { data } = await q;
  return (data ?? []).map((s) => ({ id: s.id, grade: s.grade, section: s.section, label: `Grade ${s.grade}${s.section} · ${(s.frameworks as unknown as { code: string } | null)?.code ?? ''}` }));
}
