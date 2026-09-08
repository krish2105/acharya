import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { ParentPortal } from './portal';

export default async function ParentPortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'parent') redirect('/dashboard');
  const supabase = await createClient();
  const [{ data: children }, { data: reports }, { data: inputs }, { data: consents }] = await Promise.all([
    supabase.from('students').select('id, full_name, admission_no, sections(grade, section)'),
    supabase.from('hpc_reports').select('id, student_id, term, stage, file_path, released_to_parent_at').not('released_to_parent_at', 'is', null).order('released_to_parent_at', { ascending: false }),
    supabase.from('hpc_inputs').select('student_id, term').eq('source', 'parent'),
    supabase.from('consent_records').select('student_id, purpose, granted, withdrawn_at, consent_version'),
  ]);
  return <ParentPortal user={{ fullName: user.fullName, schoolName: user.schoolName }} kids={(children ?? []) as never} reports={(reports ?? []) as never} inputs={inputs ?? []} consents={(consents ?? []) as never} />;
}
