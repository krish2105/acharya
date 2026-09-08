import { PageHeader } from '@/components/shared/page-header';
import { getT } from '@/lib/i18n/server';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { MyDay, type Period } from './my-day';
import { SubstituteButton } from './substitute-button';

const YEAR = '2026-27';

export default async function MyDayPage() {
  const user = (await getCurrentUser())!;
  const { t, locale } = await getT();
  const supabase = await createClient();
  const jsDay = new Date().getDay();
  const weekday = jsDay === 0 ? 1 : jsDay;
  const isToday = jsDay !== 0;

  const [{ data: periods }, { data: units }, { data: drafts }, pending, { data: descriptors }] = await Promise.all([
    supabase.from('timetable_periods').select('id, period_no, starts_at, ends_at, section_id, subject_id, sections(grade, section), subjects(name)').eq('teacher_id', user.id).eq('weekday', weekday).order('period_no'),
    supabase.from('units').select('id, title, subject_id, grade, sequence_no').eq('academic_year', YEAR).order('sequence_no', { ascending: false }),
    supabase.from('artifacts').select('id, section_id').eq('created_by', user.id).eq('status', 'draft').limit(200),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('created_by', user.id).eq('status', 'pending_review'),
    supabase.from('hpc_descriptors').select('id, students!inner(section_id)').eq('status', 'draft').limit(500),
  ]);

  const rows: Period[] = (periods ?? []).map((p) => {
    const sec = p.sections as unknown as { grade: string; section: string } | null;
    const unit = (units ?? []).find((u) => u.subject_id === p.subject_id && u.grade === sec?.grade) ?? null;
    return {
      id: p.id,
      periodNo: p.period_no,
      startsAt: String(p.starts_at).slice(0, 5),
      endsAt: String(p.ends_at).slice(0, 5),
      sectionId: p.section_id,
      subjectId: p.subject_id,
      klass: sec ? `${sec.grade}${sec.section}` : '',
      subject: (p.subjects as unknown as { name: string } | null)?.name ?? '',
      unit: unit ? `${unit.sequence_no}. ${unit.title}` : null,
      drafts: (drafts ?? []).filter((d) => d.section_id === p.section_id).length,
      descriptorDrafts: (descriptors ?? []).filter((d) => (d.students as unknown as { section_id: string }).section_id === p.section_id).length,
    };
  });

  const today = new Date().toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <PageHeader eyebrow={today} title={t('myday.title')} description={t('myday.sub')} actions={<SubstituteButton weekday={weekday} />} />
      <MyDay periods={rows} isToday={isToday} totals={{ drafts: drafts?.length ?? 0, pendingItems: pending.count ?? 0, descriptors: descriptors?.length ?? 0 }} />
    </div>
  );
}
