import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role === 'parent') redirect('/parent');
  if (user.role === 'student') redirect('/student');

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('school_frameworks')
    .select('frameworks(id, code, name)')
    .eq('school_id', user.schoolId);

  const frameworks = (rows ?? [])
    .map((r) => r.frameworks as unknown as { id: string; code: string; name: string } | null)
    .filter((f): f is { id: string; code: string; name: string } => f !== null);

  return (
    <AppShell
      user={{
        id: user.id,
        role: user.role,
        schoolId: user.schoolId,
        frameworkId: user.frameworkId,
        subjectId: user.subjectId,
        fullName: user.fullName,
        schoolName: user.schoolName,
        email: user.email,
      }}
      frameworks={frameworks}
    >
      {children}
    </AppShell>
  );
}
