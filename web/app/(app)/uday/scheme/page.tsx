import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { STRAND_LABEL, UDAY_TABS } from '../nav';

export default async function SchemePage({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const { grade = '6' } = await searchParams;
  const supabase = await createClient();
  const { data: units } = await supabase.from('ct_ai_units').select('id, sequence_no, title, big_idea, planned_hours, strand, ct_ai_activities(id, title, mode, duration_minutes)').eq('grade', grade).order('sequence_no');
  type U = { id: string; sequence_no: number; title: string; big_idea: string | null; planned_hours: number; strand: string; ct_ai_activities: { id: string; title: string; mode: string; duration_minutes: number }[] };
  const rows = (units ?? []) as U[];
  const total = rows.reduce((s, u) => s + Number(u.planned_hours), 0);
  const required = ['3', '4', '5'].includes(grade) ? 50 : 100;
  return (
    <div>
      <PageHeader eyebrow="UDAY" title="Scheme of work" description={`Grade ${grade}: ${total} planned hours against ${required} required, across five strands. Every unit has a plugged and an unplugged variant.`} tabs={UDAY_TABS} current="/uday/scheme"
        actions={<div className="flex gap-1">{['3', '4', '5', '6', '7', '8'].map((g) => <a key={g} href={`/uday/scheme?grade=${g}`} className={`rounded-full border px-3 py-1 text-xs ${g === grade ? 'border-primary bg-primary-soft text-primary' : ''}`}>Grade {g}</a>)}</div>} />
      <ol className="flex flex-col gap-3">
        {rows.map((u) => (
          <li key={u.id} className="card-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-primary">Unit {u.sequence_no} · {STRAND_LABEL[u.strand]}</p>
                <h3 className="font-display text-lg font-medium">{u.title}</h3>
                <p className="text-xs text-muted-foreground">{u.big_idea}</p>
              </div>
              <span className="tabular rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{u.planned_hours} h</span>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {u.ct_ai_activities.map((a) => <li key={a.id} className={`rounded-full border px-2.5 py-0.5 text-xs ${a.mode === 'unplugged' ? 'border-approved-foreground/40 bg-approved text-approved-foreground' : a.mode === 'plugged' ? 'border-navy/30 bg-secondary text-secondary-foreground' : 'bg-muted'}`}>{a.title} · {a.duration_minutes} min</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
