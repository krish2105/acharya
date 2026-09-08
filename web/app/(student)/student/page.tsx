import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { StudentPortal } from './portal';

export default async function StudentPortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'student') redirect('/dashboard');
  const supabase = await createClient();
  const { data: me } = await supabase.from('students').select('id, full_name, section_id, sections(grade, section)').eq('auth_user_id', user.id).maybeSingle();
  const [{ data: self }, { data: peerReceived }, { data: classmates }, { data: projects }, { data: units }] = await Promise.all([
    supabase.from('hpc_inputs').select('term, responses').eq('source', 'self'),
    supabase.from('hpc_peer_feedback_for_student').select('term, responses, submitted_at'),
    me ? supabase.from('students').select('id, full_name').eq('section_id', me.section_id).neq('id', me.id).order('full_name') : Promise.resolve({ data: [] }),
    supabase.from('ct_ai_projects').select('id, title, rubric_scores, teacher_comment, assessed_on, submitted_at, ct_ai_units(title)').order('submitted_at', { ascending: false }),
    me?.sections ? supabase.from('ct_ai_units').select('id, title, sequence_no').eq('grade', (me.sections as unknown as { grade: string }).grade).eq('strand', 'applied_project').order('sequence_no') : Promise.resolve({ data: [] }),
  ]);
  return <StudentPortal user={{ fullName: user.fullName, schoolName: user.schoolName }} me={me as never} selfInputs={(self ?? []) as never} peerReceived={(peerReceived ?? []) as never} classmates={(classmates ?? []) as never} projects={(projects ?? []) as never} units={(units ?? []) as never} />;
}
