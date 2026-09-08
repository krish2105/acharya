import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { TransitionsView } from './view';
import { SETU_TABS } from '../nav';

export default async function TransitionsPage() {
  const supabase = await createClient();
  const [{ data: reports }, { data: students }, { data: frameworks }] = await Promise.all([
    supabase
      .from('transition_reports')
      .select('id, target_grade, gaps, file_path, generated_at, students(full_name, admission_no), from:frameworks!transition_reports_from_framework_id_fkey(code), to:frameworks!transition_reports_to_framework_id_fkey(code)')
      .order('generated_at', { ascending: false }),
    supabase.from('students').select('id, full_name, admission_no, frameworks(code)').not('previous_framework_id', 'is', null).order('full_name'),
    supabase.from('school_frameworks').select('frameworks(code, name)'),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="SETU"
        title="Board transitions"
        description="For a student moving between boards: the target-framework outcomes with no confirmed covered equivalent, exported as a PDF for the parent meeting."
        tabs={SETU_TABS}
        current="/setu/transitions"
      />
      <TransitionsView
        reports={(reports ?? []) as never}
        students={(students ?? []) as never}
        frameworks={(frameworks ?? []).map((f) => f.frameworks as unknown as { code: string; name: string }).filter(Boolean)}
      />
    </div>
  );
}
