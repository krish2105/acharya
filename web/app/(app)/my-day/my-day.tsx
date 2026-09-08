'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { Eye, Sparkles } from 'lucide-react';
import { Stagger, StaggerItem } from '@/components/motion/primitives';
import { StatTile } from '@/components/shared/page-header';
import { useRegisterCommands } from '@/components/shell/command-palette';
import { useT } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

export interface Period {
  id: string;
  periodNo: number;
  startsAt: string;
  endsAt: string;
  sectionId: string;
  subjectId: string | null;
  klass: string;
  subject: string;
  unit: string | null;
  drafts: number;
  descriptorDrafts: number;
}

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function MyDay({ periods, isToday, totals }: { periods: Period[]; isToday: boolean; totals: { drafts: number; pendingItems: number; descriptors: number } }) {
  const { t } = useT();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const status = (p: Period): 'now' | 'done' | 'upcoming' => {
    if (!isToday) return 'upcoming';
    if (nowMin >= minutes(p.startsAt) && nowMin < minutes(p.endsAt)) return 'now';
    return nowMin >= minutes(p.endsAt) ? 'done' : 'upcoming';
  };
  const next = periods.find((p) => status(p) === 'upcoming');

  useRegisterCommands([
    { id: 'myday-worksheet', label: 'Worksheet for the next class', group: 'My Day', keywords: ['saarthi'], onSelect: () => router.push('/saarthi/generate?kind=worksheet') },
    { id: 'myday-observe', label: 'Add an observation', group: 'My Day', keywords: ['darpan'], onSelect: () => router.push('/darpan/observations') },
  ]);

  const free = 6 - periods.length;

  return (
    <div className="flex flex-col gap-6">
      {!isToday && <p className="rounded-lg bg-pending px-3 py-2 text-sm text-pending-foreground">{t('myday.sunday')}</p>}
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4" stagger={0.05}>
        <StaggerItem><StatTile label={t('myday.periods')} value={periods.length} hint={free > 0 ? `${free} ${t('myday.free').toLowerCase()}${free > 1 ? 's' : ''}` : undefined} /></StaggerItem>
        <StaggerItem><StatTile label={t('myday.drafts')} value={totals.drafts} tone={totals.drafts ? 'pending' : 'neutral'} /></StaggerItem>
        <StaggerItem><StatTile label={t('myday.items')} value={totals.pendingItems} /></StaggerItem>
        <StaggerItem><StatTile label={t('myday.descriptors')} value={totals.descriptors} tone={totals.descriptors ? 'pending' : 'neutral'} /></StaggerItem>
      </Stagger>

      {periods.length === 0 ? (
        <div className="card-surface p-10 text-center text-sm text-muted-foreground">{t('myday.empty')}</div>
      ) : (
        <ol className="relative flex flex-col gap-3">
          {periods.map((p, i) => {
            const s = status(p);
            const isNext = next?.id === p.id;
            return (
              <motion.li
                key={p.id}
                initial={reduced ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className={cn(
                  'card-surface grid grid-cols-[5.5rem_1fr] gap-4 p-4 transition-colors sm:grid-cols-[6.5rem_1fr_auto]',
                  s === 'now' && 'ring-2 ring-primary/50',
                  s === 'done' && 'opacity-60',
                )}
              >
                <div className="flex flex-col">
                  <span className="tabular text-sm font-medium">{p.startsAt}</span>
                  <span className="tabular text-xs text-muted-foreground">{p.endsAt}</span>
                  <span className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">P{p.periodNo}</span>
                  {s === 'now' && <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground"><span className="size-1.5 animate-pulse rounded-full bg-white" /> {t('myday.now')}</span>}
                  {isNext && s !== 'now' && <span className="mt-1 w-fit rounded-full bg-navy px-2 py-0.5 text-[10px] font-medium text-navy-foreground">{t('myday.next')}</span>}
                  {s === 'done' && <span className="mt-1 w-fit rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t('myday.done')}</span>}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-lg font-medium tracking-tight">Grade {p.klass} · {p.subject}</p>
                  <p className="text-sm text-muted-foreground">{t('myday.unit')}: {p.unit ?? '—'}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {p.drafts > 0 && <Link href="/approvals" className="rounded-full bg-pending px-2 py-0.5 text-pending-foreground">{p.drafts} draft{p.drafts > 1 ? 's' : ''} to approve</Link>}
                    {p.descriptorDrafts > 0 && <Link href="/approvals" className="rounded-full bg-pending px-2 py-0.5 text-pending-foreground">{p.descriptorDrafts} descriptor{p.descriptorDrafts > 1 ? 's' : ''}</Link>}
                  </div>
                </div>
                <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:flex-col">
                  <Link href={`/saarthi/generate?kind=worksheet&section=${p.sectionId}${p.subjectId ? `&subject=${p.subjectId}` : ''}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:border-primary/40 hover:bg-primary-soft"><Sparkles className="size-3.5" /> {t('myday.worksheet')}</Link>
                  <Link href={`/darpan/observations?section=${p.sectionId}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:border-primary/40 hover:bg-primary-soft"><Eye className="size-3.5" /> {t('myday.observe')}</Link>
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
