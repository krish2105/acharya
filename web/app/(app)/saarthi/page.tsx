import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Counter, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { KIND_LABEL, KINDS, SAARTHI_TABS } from './nav';

export default async function SaarthiOverview() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const [{ data: mine }, { data: saved }] = await Promise.all([
    supabase.from('artifacts').select('kind, status'),
    supabase.rpc('time_saved_summary', { p_school_id: user.schoolId }),
  ]);
  const rows = mine ?? [];
  const byKind = new Map<string, number>();
  for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
  const hours = ((saved ?? []) as { hours_saved: number; teacher_id: string }[]).filter((s) => user.role === 'teacher' ? s.teacher_id === user.id : true).reduce((s, r) => s + Number(r.hours_saved), 0);

  return (
    <div>
      <PageHeader
        eyebrow="SAARTHI · charioteer"
        title="The tool a teacher opens instead of a free chatbot."
        description="Every draft starts from a unit or an outcome, is schema-validated, keeps your edits next to the generated version, and waits for your approval."
        tabs={SAARTHI_TABS}
        current="/saarthi"
      />
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4" stagger={0.05}>
        {[
          { l: 'Drafts', v: rows.filter((r) => r.status === 'draft').length, t: '' },
          { l: 'Approved', v: rows.filter((r) => r.status === 'approved' || r.status === 'shared').length, t: 'text-approved-foreground' },
          { l: 'Shared with department', v: rows.filter((r) => r.status === 'shared').length, t: '' },
          { l: 'Hours saved', v: Math.round(hours), t: 'text-primary' },
        ].map((s) => (
          <StaggerItem key={s.l} className="card-surface flex flex-col gap-1 p-5">
            <p className="text-xs text-muted-foreground">{s.l}</p>
            <p className={`font-display text-3xl font-medium tracking-tight ${s.t}`}><Counter value={s.v} /></p>
          </StaggerItem>
        ))}
      </Stagger>
      <Stagger className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3" stagger={0.04}>
        {[
          { kind: 'lesson_plan', href: '/saarthi/plan' }, { kind: 'worksheet', href: '/saarthi/worksheet' }, { kind: 'rubric', href: '/saarthi/rubric' },
          { kind: 'parent_message', href: '/saarthi/message' }, { kind: 'remediation_set', href: '/saarthi/remediation' }, { kind: 'revision_sheet', href: '/saarthi/revision' }, { kind: 'activity', href: '/saarthi/activity' },
        ].map((g) => (
          <StaggerItem key={g.kind}>
            <Link href={g.href} className="card-surface group flex items-center gap-3 p-5 transition-shadow hover:shadow-float">
              <span className="flex-1">
                <span className="font-display text-lg font-medium">{KIND_LABEL[g.kind as (typeof KINDS)[number]]}</span>
                <span className="block text-xs text-muted-foreground tabular">{byKind.get(g.kind) ?? 0} so far</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
