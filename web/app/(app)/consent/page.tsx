import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { getT } from '@/lib/i18n/server';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { ConsentLedger, type ConsentRow, type ErasureRow } from './ledger';

export default async function ConsentPage() {
  const user = (await getCurrentUser())!;
  if (!['principal', 'academic_head'].includes(user.role)) redirect('/dashboard');
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: consents }, { data: erasures }] = await Promise.all([
    supabase.from('consent_records').select('student_id, purpose, granted, withdrawn_at, consent_version, via, students(full_name, admission_no, sections(grade, section))').eq('school_id', user.schoolId).order('granted_at').limit(3000),
    supabase.from('erasure_requests').select('id, student_id, reason, status, requested_at, decision_note, executed_at, students(full_name, admission_no)').eq('school_id', user.schoolId).order('requested_at', { ascending: false }),
  ]);
  return (
    <div>
      <PageHeader eyebrow="DPDP Act 2023" title={t('consent.title')} description={t('consent.sub')} />
      <ConsentLedger consents={(consents ?? []) as unknown as ConsentRow[]} erasures={(erasures ?? []) as unknown as ErasureRow[]} />
    </div>
  );
}
