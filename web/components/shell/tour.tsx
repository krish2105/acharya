'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/provider';

const KEY = 'acharya.tour.step';

const STEPS = [
  { path: '/dashboard', title: 'Your day at a glance', body: 'Pending approvals, how many PII spans were redacted before any model call, and the recent ledger. Nothing on this screen was decided by AI.' },
  { path: '/setu/coverage', title: 'SETU · the curriculum spine', body: 'Every outcome across CBSE, IB, Cambridge and AP in one graph, with taught-vs-assessed coverage per section.' },
  { path: '/prashna/review', title: 'PRASHNA · HOD review', body: 'Generated items wait here with the outcome pinned on top. A approves, C requests changes, R rejects.' },
  { path: '/saarthi', title: 'SAARTHI · teacher copilot', body: 'Lesson plans, worksheets, rubrics and parent messages — always starting from an outcome, always approved before they are shared.' },
  { path: '/darpan/descriptors', title: 'DARPAN · progress cards', body: 'Descriptors drafted only from what teachers wrote and 360° inputs. Comparative, diagnostic or predictive language is rejected before you see it.' },
  { path: '/uday', title: 'UDAY · AI & CT programme', body: 'Hours ledger, student projects and teacher CPD — the evidence pack the board asks for.' },
  { path: '/approvals', title: 'One queue for everything', body: 'j/k to move, A to approve. Every approval writes a ledger row that the database itself checks before a status can change.' },
];

export function Tour() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { t } = useT();
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (params.get('tour') === '1') {
        localStorage.setItem(KEY, '0');
        setStep(0);
        return;
      }
      const raw = localStorage.getItem(KEY);
      setStep(raw === null ? null : Number(raw));
    } catch {
      setStep(null);
    }
  }, [params]);

  const current = step !== null ? STEPS[step] : undefined;
  const visible = !!current && (pathname === current.path || pathname.startsWith(current.path + '/'));

  const go = (next: number | null) => {
    try {
      if (next === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(next));
    } catch {}
    setStep(next);
    if (next !== null) router.push(STEPS[next].path);
  };

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.aside
          key={step}
          role="dialog"
          aria-label="Guided tour"
          initial={reduced ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? undefined : { opacity: 0, y: 8 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed bottom-6 right-6 z-50 w-[min(24rem,calc(100vw-3rem))] rounded-2xl border bg-card p-5 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary">Tour · {step! + 1} / {STEPS.length}</p>
            <button type="button" onClick={() => go(null)} aria-label={t('tour.skip')} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <h3 className="font-display text-lg font-medium tracking-tight">{current.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1" aria-hidden>
              {STEPS.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`} />)}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => go(null)}>{t('tour.skip')}</Button>
              {step! < STEPS.length - 1 ? <Button size="sm" onClick={() => go(step! + 1)}>{t('tour.next')}</Button> : <Button size="sm" onClick={() => go(null)}>{t('tour.done')}</Button>}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
