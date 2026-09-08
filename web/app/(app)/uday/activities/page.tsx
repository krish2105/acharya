import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { STRAND_LABEL, UDAY_TABS } from '../nav';

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ mode?: string; strand?: string; grade?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase.from('ct_ai_activities').select('id, title, mode, duration_minutes, materials, instructions_md, assessment_note, ct_ai_units!inner(grade, title, strand)').order('title').limit(120);
  if (sp.mode) q = q.eq('mode', sp.mode);
  if (sp.grade) q = q.eq('ct_ai_units.grade', sp.grade);
  if (sp.strand) q = q.eq('ct_ai_units.strand', sp.strand);
  const { data } = await q;
  type A = { id: string; title: string; mode: string; duration_minutes: number; materials: string | null; instructions_md: string; assessment_note: string | null; ct_ai_units: { grade: string; title: string; strand: string } };
  const rows = (data ?? []) as unknown as A[];
  const link = (k: string, v: string) => { const n = new URLSearchParams(sp as Record<string, string>); if (sp[k as keyof typeof sp] === v) n.delete(k); else n.set(k, v); return `/uday/activities?${n.toString()}`; };
  return (
    <div>
      <PageHeader eyebrow="UDAY" title="Activity library" description="Plugged and unplugged variants for every unit, so the programme runs without a lab. Ethics & bias activities are non-technical and age-appropriate." tabs={UDAY_TABS} current="/uday/activities" />
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {['unplugged', 'plugged', 'hybrid'].map((m) => <a key={m} href={link('mode', m)} className={`rounded-full border px-3 py-1 capitalize ${sp.mode === m ? 'border-primary bg-primary-soft text-primary' : ''}`}>{m}</a>)}
        <span className="mx-1 text-muted-foreground">·</span>
        {Object.entries(STRAND_LABEL).map(([k, l]) => <a key={k} href={link('strand', k)} className={`rounded-full border px-3 py-1 ${sp.strand === k ? 'border-primary bg-primary-soft text-primary' : ''}`}>{l}</a>)}
        <span className="mx-1 text-muted-foreground">·</span>
        {['3', '4', '5', '6', '7', '8'].map((g) => <a key={g} href={link('grade', g)} className={`rounded-full border px-3 py-1 ${sp.grade === g ? 'border-primary bg-primary-soft text-primary' : ''}`}>G{g}</a>)}
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((a) => (
          <li key={a.id} className="card-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-mono text-xs text-primary">Grade {a.ct_ai_units.grade} · {STRAND_LABEL[a.ct_ai_units.strand]}</p><h3 className="font-medium">{a.title}</h3></div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${a.mode === 'unplugged' ? 'bg-approved text-approved-foreground' : 'bg-secondary text-secondary-foreground'}`}>{a.mode} · {a.duration_minutes} min</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{a.instructions_md}</p>
            {a.materials && <p className="mt-2 text-xs"><span className="text-muted-foreground">Materials:</span> {a.materials}</p>}
            {a.assessment_note && <p className="mt-1 text-xs"><span className="text-muted-foreground">Assess:</span> {a.assessment_note}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{rows.length} activities shown</p>
    </div>
  );
}
