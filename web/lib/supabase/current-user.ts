import 'server-only';
import type { Role } from '@/lib/rbac';
import { createClient } from './server';

export interface CurrentUser {
  id: string;
  fullName: string;
  role: Role;
  schoolId: string;
  schoolName: string;
  frameworkId: string | null;
  subjectId: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, school_id, framework_id, subject_id, schools(name)')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role as Role,
    schoolId: profile.school_id,
    schoolName: (profile.schools as unknown as { name: string } | null)?.name ?? '',
    frameworkId: profile.framework_id,
    subjectId: profile.subject_id,
  };
}
