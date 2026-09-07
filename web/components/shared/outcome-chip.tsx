'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

export interface Outcome {
  frameworkCode: string;
  refCode: string;
  statement: string;
}

/**
 * The second signature element (Section 7): every item, worksheet, plan and
 * descriptor carries a chip showing its framework and outcome code. Click
 * it to see the outcome statement. This is what proves alignment.
 *
 * Phase 0 wires this to a hardcoded demo outcome -- SETU's real
 * learning_outcomes table doesn't exist until Phase 1.
 */
export function OutcomeChip({ outcome }: { outcome: Outcome }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <Badge
        variant="outline"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="cursor-pointer gap-1 border-primary/40 text-primary hover:bg-primary/10"
      >
        <span className="font-semibold">{outcome.frameworkCode}</span>
        <span className="text-muted-foreground">·</span>
        <span>{outcome.refCode}</span>
      </Badge>

      {open && (
        <div
          role="tooltip"
          className="absolute z-10 mt-2 w-72 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md"
        >
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {outcome.frameworkCode} {outcome.refCode}
          </p>
          <p>{outcome.statement}</p>
        </div>
      )}
    </div>
  );
}
