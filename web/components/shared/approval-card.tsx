'use client';

import { useMemo, useState } from 'react';
import { diffWords } from 'diff';
import { Check, Loader2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OutcomeChip, type Outcome } from './outcome-chip';

export interface ApprovalCardProps {
  title: string;
  outcome: Outcome;
  generatedText: string;
  finalText: string;
  approved: boolean;
  onApprove?: () => void | Promise<void>;
  onReject?: () => void | Promise<void>;
  meta?: string;
  className?: string;
}

/**
 * The signature element (Section 7): generated draft on the left, the
 * teacher's edited version on the right, changed spans highlighted, the
 * linked outcome pinned at the top, one large Approve button.
 */
export function ApprovalCard({ title, outcome, generatedText, finalText, approved, onApprove, onReject, meta, className }: ApprovalCardProps) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const reduced = useReducedMotion();
  const parts = useMemo(() => diffWords(generatedText, finalText), [generatedText, finalText]);
  const changed = parts.filter((p) => p.added || p.removed).length;

  const run = async (kind: 'approve' | 'reject', fn?: () => void | Promise<void>) => {
    if (!fn || approved) return;
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.article
      layout
      className={cn('card-surface relative overflow-hidden', approved && 'ring-1 ring-approved-foreground/30', className)}
      transition={{ type: 'spring', stiffness: 300, damping: 34 }}
    >
      <AnimatePresence>
        {approved && !reduced && (
          <motion.span
            key="flash"
            aria-hidden
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 bg-approved"
          />
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 flex-col gap-2">
          <OutcomeChip outcome={outcome} />
          <h3 className="font-display text-xl font-medium tracking-tight">{title}</h3>
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        </div>
        <p className="tabular text-xs text-muted-foreground">
          {changed === 0 ? 'Approved as generated' : `${changed} changed span${changed === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
        <section className="bg-card p-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Generated draft</p>
          <p className="text-sm leading-relaxed">
            {parts.filter((p) => !p.added).map((p, i) => (p.removed ? <span key={i} className="diff-removed">{p.value}</span> : <span key={i}>{p.value}</span>))}
          </p>
        </section>
        <section className="bg-card p-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Teacher&apos;s edited version</p>
          <p className="text-sm leading-relaxed">
            {parts.filter((p) => !p.removed).map((p, i) => (p.added ? <span key={i} className="diff-added">{p.value}</span> : <span key={i}>{p.value}</span>))}
          </p>
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-5 py-4">
        <AnimatePresence mode="wait" initial={false}>
          {approved ? (
            <motion.p
              key="approved"
              data-testid="approval-status"
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-approved px-2.5 py-1 text-xs font-medium text-approved-foreground"
            >
              <Check className="size-3.5" /> Approved
            </motion.p>
          ) : (
            <motion.p key="pending" initial={false} className="inline-flex items-center rounded-full bg-pending px-2.5 py-1 text-xs font-medium text-pending-foreground">
              Awaiting teacher approval
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          {onReject && !approved && (
            <Button variant="outline" onClick={() => run('reject', onReject)} disabled={busy !== null}>
              {busy === 'reject' ? <Loader2 className="size-4 animate-spin" /> : null}
              Reject
            </Button>
          )}
          <motion.div whileTap={reduced || approved ? undefined : { scale: 0.97 }}>
            <Button size="lg" className="min-w-32 shadow-glow" disabled={approved || busy !== null} onClick={() => run('approve', onApprove)}>
              {busy === 'approve' ? <Loader2 className="size-4 animate-spin" /> : approved ? <Check className="size-4" /> : null}
              {approved ? 'Approved' : busy === 'approve' ? 'Approving…' : 'Approve'}
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.article>
  );
}
