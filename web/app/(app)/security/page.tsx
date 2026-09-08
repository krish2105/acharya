import { PageHeader } from '@/components/shared/page-header';
import { getT } from '@/lib/i18n/server';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { SecurityPanel } from './security-panel';

const MFA_ROLES = ['principal', 'academic_head', 'super_admin'];

export default async function SecurityPage() {
  const user = (await getCurrentUser())!;
  const { t } = await getT();
  return (
    <div>
      <PageHeader eyebrow={user.role.replace(/_/g, ' ')} title={t('security.title')} description={t('security.sub')} />
      <SecurityPanel mfaRequired={MFA_ROLES.includes(user.role)} />
    </div>
  );
}
