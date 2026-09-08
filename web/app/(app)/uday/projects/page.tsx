import { PageHeader, StatTile } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { ProjectsTable } from './table';
import { UDAY_TABS } from '../nav';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('ct_ai_projects').select('id, title, artefact_path, rubric_scores, teacher_comment, assessed_on, submitted_at, students(full_name, sections(grade, section)), ct_ai_units(title)').order('submitted_at', { ascending: false, nullsFirst: false });
  type P = { id: string; title: string | null; artefact_path: string | null; rubric_scores: Record<string, number> | null; teacher_comment: string | null; assessed_on: string | null; submitted_at: string | null; students: { full_name: string; sections: { grade: string; section: string } | null } | null; ct_ai_units: { title: string } | null };
  const rows = (data ?? []) as unknown as P[];
  return (
    <div>
      <PageHeader eyebrow="UDAY" title="Project assessment" description="Students upload artefacts from their portal; teachers score every rubric criterion themselves. Nothing here is auto-graded." tabs={UDAY_TABS} current="/uday/projects" />
      <div className="mb-4 grid grid-cols-3 gap-4">
        <StatTile label="Projects" value={rows.length} />
        <StatTile label="Assessed" value={rows.filter((r) => r.assessed_on).length} tone="approved" />
        <StatTile label="Awaiting assessment" value={rows.filter((r) => !r.assessed_on).length} tone="pending" />
      </div>
      <ProjectsTable rows={rows as never} />
    </div>
  );
}
