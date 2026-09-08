import { PageHeader } from '@/components/shared/page-header';
import { mySections } from '@/lib/darpan/sections';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { HoursForm } from './form';
import { UDAY_TABS, YEAR } from '../nav';

export default async function HoursPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const sections = (await mySections(supabase, user)).filter((s) => ['3', '4', '5', '6', '7', '8'].includes(s.grade));
  const [{ data: activities }, { data: ledger }] = await Promise.all([
    supabase.from('ct_ai_activities').select('id, title, mode, ct_ai_units!inner(grade, sequence_no)').order('title'),
    supabase.from('ct_ai_hours_ledger').select('id, delivered_on, minutes, note, evidence_path, sections(grade, section), ct_ai_activities(title, mode), profiles(full_name)').eq('academic_year', YEAR).order('delivered_on', { ascending: false }).limit(40),
  ]);
  type L = { id: string; delivered_on: string; minutes: number; note: string | null; evidence_path: string | null; sections: { grade: string; section: string } | null; ct_ai_activities: { title: string; mode: string } | null; profiles: { full_name: string } | null };
  return (
    <div>
      <PageHeader eyebrow="UDAY" title="Hours ledger" description="Log each delivered session per section, with optional evidence (a photo of the board, a worksheet). This is what proves the 50/100-hour requirement." tabs={UDAY_TABS} current="/uday/hours" />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <HoursForm sections={sections} activities={((activities ?? []) as unknown as { id: string; title: string; mode: string; ct_ai_units: { grade: string; sequence_no: number } }[]).map((a) => ({ id: a.id, label: `G${a.ct_ai_units.grade} U${a.ct_ai_units.sequence_no} · ${a.title} (${a.mode})`, grade: a.ct_ai_units.grade }))} />
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Section</th><th className="px-4 py-2 font-medium">Activity</th><th className="px-4 py-2 font-medium text-right">Min</th><th className="px-4 py-2 font-medium">Teacher</th><th className="px-4 py-2 font-medium">Evidence</th></tr></thead>
            <tbody>{((ledger ?? []) as unknown as L[]).map((l) => (
              <tr key={l.id} className="border-t"><td className="px-4 py-2 tabular">{l.delivered_on}</td><td className="px-4 py-2">{l.sections?.grade}{l.sections?.section}</td><td className="px-4 py-2">{l.ct_ai_activities?.title ?? l.note ?? '—'} <span className="text-xs text-muted-foreground">{l.ct_ai_activities?.mode}</span></td><td className="px-4 py-2 text-right tabular">{l.minutes}</td><td className="px-4 py-2 text-xs text-muted-foreground">{l.profiles?.full_name}</td><td className="px-4 py-2 text-xs">{l.evidence_path ? 'attached' : '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
