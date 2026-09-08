'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface Outcome {
  frameworkCode: string;
  refCode: string;
  statement: string;
  id?: string;
}

/**
 * The second signature element (Section 7): every item, worksheet, plan and
 * descriptor carries a chip showing its framework and outcome code. Click
 * to read the statement. This is what proves alignment.
 */
export function OutcomeChip({ outcome, size = 'md', className }: { outcome: Outcome; size?: 'sm' | 'md'; className?: string }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary-soft/70 font-mono text-primary transition-colors hover:border-primary/50 hover:bg-primary-soft',
          size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs',
        )}
      >
        <span className="font-semibold tracking-wide">{outcome.frameworkCode}</span>
        <span aria-hidden className="text-primary/40">
          /
        </span>
        <span>{outcome.refCode}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="tooltip"
            initial={reduced ? false : { opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 z-20 mt-2 w-80 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-float"
          >
            <p className="mb-1 font-mono text-[11px] text-muted-foreground">
              {outcome.frameworkCode} · {outcome.refCode}
            </p>
            <p className="leading-relaxed">{outcome.statement}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
