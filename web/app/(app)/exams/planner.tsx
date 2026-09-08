'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarPlus, Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { StatusPill } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createImprovementPaper } from '../prashna/actions';
import { addExamEvent } from './actions';

export interface CalItem { id: string; date: string; end: string | null; title: string; kind: string; status?: string; grade?: string | null; href?: string; note?: string | null }
export interface PaperRow { id: string; title: string; exam_kind: string | null; scheduled_on: string | null; status: string; paired_with: string | null; klass: string }

const KIND_TONE: Record<string, string> = {
  board_main: 'bg-primary text-primary-foreground', board_improvement: 'bg-navy text-navy-foreground', correction_window: 'bg-pending text-pending-foreground', result: 'bg-approved text-approved-foreground', internal: 'bg-muted text-muted-foreground',
  unit_test: 'bg-muted text-muted-foreground', midterm: 'bg-muted text-muted-foreground', preboard: 'bg-pending text-pending-foreground', main_board_practice: 'bg-primary text-primary-foreground', improvement_practice: 'bg-navy text-navy-foreground', mock: 'bg-muted text-muted-foreground',
};
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const days = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400_000);

export function ExamAgenda({ items }: { items: CalItem[] }) {
  const reduced = useReducedMotion();
  const months = new Map<string, CalItem[]>();
  for (const it of [...items].sort((a, b) => a.date.localeCompare(b.date))) {
    const m = new Date(it.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    months.set(m, [...(months.get(m) ?? []), it]);
  }
  if (items.length === 0) return <p className="card-surface p-6 text-sm text-muted-foreground">Nothing scheduled yet.</p>;
  return (
    <div className="flex flex-col gap-5">
      {[...months.entries()].map(([month, list], mi) => (
        <section key={month}>
          <h3 className="mb-2 font-display text-lg font-medium tracking-tight">{month}</h3>
          <ol className="card-surface divide-y">
            {list.map((it, i) => (
              <motion.li key={it.id} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (mi * 4 + i) * 0.03 }} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-sm">
                <span className="tabular text-xs text-muted-foreground">{fmt(it.date)}{it.end ? `–${fmt(it.end)}` : ''}</span>
                <span className="min-w-0">
                  {it.href ? <Link href={it.href} className="font-medium underline-offset-4 hover:underline">{it.title}</Link> : <span className="font-medium">{it.title}</span>}
                  {it.grade && <span className="ml-2 text-xs text-muted-foreground">Grade {it.grade}</span>}
                  {it.note && <span className="block text-xs text-muted-foreground">{it.note}</span>}
                </span>
                <span className="flex items-center gap-2">
                  {it.status && <StatusPill status={it.status} />}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${KIND_TONE[it.kind] ?? 'bg-muted text-muted-foreground'}`}>{it.kind.replace(/_/g, ' ')}</span>
                </span>
              </motion.li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function TwoExamPlanner({ mains, improvements }: { mains: PaperRow[]; improvements: PaperRow[] }) {
  const [pending, start] = useTransition();
  if (mains.length === 0) return <p className="card-surface p-6 text-sm text-muted-foreground">No Class 10 main-board practice papers yet. Assemble one in PRASHNA and it appears here with its improvement pair.</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {mains.map((m) => {
        const imp = improvements.find((p) => p.paired_with === m.id) ?? null;
        return (
          <li key={m.id} className="card-surface flex flex-col gap-3 p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="min-w-0 rounded-xl bg-primary-soft p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-primary">Main</p>
                <Link href={`/prashna/papers/${m.id}`} className="block truncate text-sm font-medium underline-offset-4 hover:underline">{m.title}</Link>
                <p className="text-xs text-muted-foreground">{m.klass} · {m.scheduled_on ? fmt(m.scheduled_on) : 'undated'} · <StatusPill status={m.status} /></p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
              <div className={`min-w-0 rounded-xl p-3 ${imp ? 'bg-secondary' : 'border border-dashed'}`}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-navy">Improvement</p>
                {imp ? (
                  <>
                    <Link href={`/prashna/papers/${imp.id}`} className="block truncate text-sm font-medium underline-offset-4 hover:underline">{imp.title}</Link>
                    <p className="text-xs text-muted-foreground">{imp.scheduled_on ? fmt(imp.scheduled_on) : 'undated'}{m.scheduled_on && imp.scheduled_on ? ` · ${days(m.scheduled_on, imp.scheduled_on)} days later` : ''} · <StatusPill status={imp.status} /></p>
                  </>
                ) : (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { try { await createImprovementPaper(m.id); toast.success('Improvement paper assembled from the same blueprint'); } catch (e) { toast.error((e as Error).message); } })}>
                    {pending ? <Loader2 className="size-4 animate-spin" /> : null} Create matched paper
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Same blueprint, disjoint items, same competency share. The better score counts — the student decides whether to sit the second exam.</p>
          </li>
        );
      })}
    </ul>
  );
}

export function AddEventForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="card-surface grid grid-cols-2 gap-3 p-4 md:grid-cols-6"
      onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); start(async () => { try { await addExamEvent(fd); form.reset(); toast.success('Added to the calendar'); } catch (err) { toast.error((err as Error).message); } }); }}
    >
      <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">Title<Input name="title" required className="h-9" /></label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">Kind<select name="kind" className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"><option value="internal">Internal</option><option value="board_main">Board · main</option><option value="board_improvement">Board · improvement</option><option value="correction_window">Correction window</option><option value="result">Result</option></select></label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">Grade<Input name="grade" placeholder="10" className="h-9" /></label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">Starts<Input name="starts_on" type="date" required className="h-9" /></label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">Ends<Input name="ends_on" type="date" className="h-9" /></label>
      <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground md:col-span-5">Note<Input name="note" className="h-9" /></label>
      <Button type="submit" disabled={pending} className="self-end">{pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />} Add</Button>
    </form>
  );
}
