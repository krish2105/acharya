import { PageHeader } from '@/components/shared/page-header';
import { getT } from '@/lib/i18n/server';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { ApprovalsQueue, type QueueEntry } from './queue';

type LO = { ref_code: string; statement: string; frameworks: { code: string } | null };
type Link = { learning_outcomes: LO | null };
interface ItemRow { id: string; stem: string; item_type: string; marks: number; subject_id: string; framework_id: string; subjects: { name: string } | null; item_versions: { version: number; body: unknown }[]; item_outcomes: Link[] }
interface ArtifactRow { id: string; title: string; kind: string; body: unknown; generated_version: unknown; language: string; artifact_outcomes: Link[] }
interface DescriptorRow { id: string; domain: string; term: string; student_id: string; generated_text: string | null; final_text: string | null; students: { full_name: string } | null }

const FALLBACK = { frameworkCode: '—', refCode: 'unlinked', statement: 'No outcome link found' };
const outcomeOf = (links: Link[] | null | undefined) => {
  const lo = links?.[0]?.learning_outcomes;
  return lo ? { frameworkCode: lo.frameworks?.code ?? '', refCode: lo.ref_code, statement: lo.statement } : FALLBACK;
};
const pretty = (v: unknown) => JSON.stringify(v ?? {}, null, 2);

export default async function ApprovalsPage() {
  const user = (await getCurrentUser())!;
  const { t } = await getT();
  const supabase = await createClient();

  let itemsQ = supabase.from('items').select('id, stem, item_type, marks, subject_id, framework_id, subjects(name), item_versions(version, body), item_outcomes(learning_outcomes(ref_code, statement, frameworks(code)))').eq('status', 'pending_review').order('updated_at').limit(50);
  if (user.role === 'hod' && user.subjectId) itemsQ = itemsQ.eq('subject_id', user.subjectId);
  let artQ = supabase.from('artifacts').select('id, title, kind, body, generated_version, language, artifact_outcomes(learning_outcomes(ref_code, statement, frameworks(code)))').eq('status', 'draft').order('created_at', { ascending: false }).limit(50);
  if (!['principal', 'academic_head'].includes(user.role)) artQ = artQ.eq('created_by', user.id);
  const descQ = supabase.from('hpc_descriptors').select('id, domain, term, student_id, generated_text, final_text, students(full_name)').eq('status', 'draft').limit(50);

  const [{ data: items }, { data: artifacts }, { data: descriptors }] = await Promise.all([itemsQ, artQ, descQ]);

  const entries: QueueEntry[] = [];
  for (const i of (items ?? []) as unknown as ItemRow[]) {
    if (!can(user, 'approve', 'prashna', { subjectId: i.subject_id, frameworkId: i.framework_id })) continue;
    const versions = [...(i.item_versions ?? [])].sort((a, b) => a.version - b.version);
    entries.push({ id: i.id, type: 'item', title: i.stem.slice(0, 100), meta: `${i.item_type.replace(/_/g, ' ')} · ${i.marks} marks · ${i.subjects?.name ?? ''}`, outcome: outcomeOf(i.item_outcomes), generated: pretty(versions[0]?.body ?? { stem: i.stem }), final: pretty(versions[versions.length - 1]?.body ?? { stem: i.stem }), href: '/prashna/review' });
  }
  for (const a of (artifacts ?? []) as unknown as ArtifactRow[]) {
    entries.push({ id: a.id, type: 'artifact', title: a.title, meta: `${a.kind.replace(/_/g, ' ')} · ${a.language === 'hi' ? 'हिन्दी' : 'English'}`, outcome: outcomeOf(a.artifact_outcomes), generated: pretty(a.generated_version ?? a.body), final: pretty(a.body), href: `/saarthi/history/${a.id}` });
  }
  for (const d of (descriptors ?? []) as unknown as DescriptorRow[]) {
    entries.push({ id: d.id, type: 'descriptor', title: `${d.students?.full_name ?? 'Student'} · ${d.domain.replace(/_/g, ' ')}`, meta: `HPC descriptor · ${d.term}`, outcome: { frameworkCode: 'HPC', refCode: d.domain, statement: 'Holistic Progress Card domain descriptor' }, generated: d.generated_text ?? '', final: d.final_text ?? d.generated_text ?? '', href: `/darpan/descriptors/${d.student_id}` });
  }

  return (
    <div>
      <PageHeader eyebrow={`${entries.length} waiting`} title={t('approvals.title')} description={t('approvals.sub')} />
      <ApprovalsQueue entries={entries} />
    </div>
  );
}
