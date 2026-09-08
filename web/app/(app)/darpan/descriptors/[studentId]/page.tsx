import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { DescriptorEditor } from './editor';
import { CURRENT_TERM, DARPAN_TABS, DOMAINS } from '../../nav';

export default async function StudentDescriptorsPage({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ term?: string }> }) {
  const { studentId } = await params;
  const { term = CURRENT_TERM } = await searchParams;
  const supabase = await createClient();
  const [{ data: student }, { data: descs }, { data: obs }, { data: inputs }] = await Promise.all([
    supabase.from('students').select('id, full_name, admission_no, sections(grade, section)').eq('id', studentId).maybeSingle(),
    supabase.from('hpc_descriptors').select('id, domain, generated_text, generated_json, final_text, status, language').eq('student_id', studentId).eq('term', term),
    supabase.from('observations').select('domain').eq('student_id', studentId),
    supabase.from('hpc_inputs').select('source').eq('student_id', studentId).eq('term', term),
  ]);
  if (!student) notFound();
  const sec = student.sections as unknown as { grade: string; section: string } | null;
  return (
    <div>
      <PageHeader eyebrow={`DARPAN · ${term}`} title={student.full_name} description={`${student.admission_no} · Grade ${sec?.grade ?? ''}${sec?.section ?? ''} · ${(obs ?? []).length} observations · ${(inputs ?? []).length} inputs this term`} tabs={DARPAN_TABS} current="/darpan/descriptors" />
      <DescriptorEditor studentId={studentId} term={term} domains={[...DOMAINS]} descriptors={(descs ?? []) as never} evidenceByDomain={Object.fromEntries(DOMAINS.map((d) => [d, (obs ?? []).filter((o) => o.domain === d).length]))} totalEvidence={(obs ?? []).length + (inputs ?? []).length} />
    </div>
  );
}
