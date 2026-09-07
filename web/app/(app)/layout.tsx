import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/shared/sidebar';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const supabase = await createClient();
  const { data: schoolFrameworks } = await supabase
    .from('school_frameworks')
    .select('frameworks(id, code, name)')
    .eq('school_id', user.schoolId);

  const frameworks = (schoolFrameworks ?? [])
    .map((row) => row.frameworks as unknown as { id: string; code: string; name: string } | null)
    .filter((f): f is { id: string; code: string; name: string } => f !== null);

  return (
    <div className="flex min-h-svh">
      <Sidebar
        user={{
          id: user.id,
          fullName: user.fullName,
          schoolName: user.schoolName,
          role: user.role,
          schoolId: user.schoolId,
          frameworkId: user.frameworkId,
          subjectId: user.subjectId,
        }}
        frameworks={frameworks}
      />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
