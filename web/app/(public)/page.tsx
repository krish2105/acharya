import { redirect } from 'next/navigation';
import { Landing } from '@/components/public/landing';
import { getCurrentUser } from '@/lib/supabase/current-user';

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'parent' ? '/parent' : user.role === 'student' ? '/student' : '/dashboard');
  return <Landing />;
}
