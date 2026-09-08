import { PageHeader } from '@/components/shared/page-header';
import { getT } from '@/lib/i18n/server';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { AddEventForm, ExamAgenda, TwoExamPlanner, type CalItem, type PaperRow } from './planner';

export default async function ExamsPage() {
  const user = (await getCurrentUser())!;
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: events }, { data: papers }] = await Promise.all([
    supabase.from('exam_events').select('id, title, kind, grade, starts_on, ends_on, note').eq('school_id', user.schoolId).order('starts_on'),
    supabase.from('papers').select('id, title, exam_kind, scheduled_on, status, paired_with, sections(grade, section)').eq('school_id', user.schoolId).order('scheduled_on'),
  ]);
  const rows: PaperRow[] = (papers ?? []).map((p) => {
    const s = p.sections as unknown as { grade: string; section: string } | null;
    return { id: p.id, title: p.title, exam_kind: p.exam_kind, scheduled_on: p.scheduled_on, status: p.status, paired_with: p.paired_with, klass: s ? `Grade ${s.grade}${s.section}` : '' };
  });
  const items: CalItem[] = [
    ...(events ?? []).map((e) => ({ id: e.id, date: e.starts_on, end: e.ends_on, title: e.title, kind: e.kind, grade: e.grade, note: e.note })),
    ...rows.filter((p) => p.scheduled_on).map((p) => ({ id: p.id, date: p.scheduled_on!, end: null, title: `${p.title} · ${p.klass}`, kind: p.exam_kind ?? 'internal', status: p.status, href: `/prashna/papers/${p.id}` })),
  ];
  const mains = rows.filter((p) => p.exam_kind === 'main_board_practice');
  const improvements = rows.filter((p) => p.exam_kind === 'improvement_practice');
  const canAdd = ['principal', 'academic_head', 'exam_officer'].includes(user.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="2026-27" title={t('exams.title')} description={t('exams.sub')} />
      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Class 10 two-exam planner</h3>
        <TwoExamPlanner mains={mains} improvements={improvements} />
      </section>
      {canAdd && <AddEventForm />}
      <ExamAgenda items={items} />
    </div>
  );
}
