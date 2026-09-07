'use client';

import { useMemo, useState } from 'react';
import { diffWords } from 'diff';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { OutcomeChip, type Outcome } from './outcome-chip';

export interface ApprovalCardProps {
  title: string;
  outcome: Outcome;
  generatedText: string;
  finalText: string;
  approved: boolean;
  onApprove?: () => void | Promise<void>;
}

/**
 * The signature element (Section 7): generated draft on the left, the
 * teacher's edited version on the right, changed spans highlighted, the
 * linked outcome pinned at the top, one large Approve button. This is what
 * makes "human in the loop" visible rather than claimed.
 */
export function ApprovalCard({ title, outcome, generatedText, finalText, approved, onApprove }: ApprovalCardProps) {
  const [approving, setApproving] = useState(false);
  const reducedMotion = useReducedMotion();

  const parts = useMemo(() => diffWords(generatedText, finalText), [generatedText, finalText]);

  const handleApprove = async () => {
    if (!onApprove || approved) return;
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader className="gap-2">
        <OutcomeChip outcome={outcome} />
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Generated draft
            </p>
            <p className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
              {parts
                .filter((p) => !p.added)
                .map((p, i) =>
                  p.removed ? (
                    <span key={i} className="rounded bg-red-100 text-red-800 line-through dark:bg-red-950 dark:text-red-300">
                      {p.value}
                    </span>
                  ) : (
                    <span key={i}>{p.value}</span>
                  ),
                )}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Teacher&apos;s edited version
            </p>
            <p className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
              {parts
                .filter((p) => !p.removed)
                .map((p, i) =>
                  p.added ? (
                    <span key={i} className="rounded bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                      {p.value}
                    </span>
                  ) : (
                    <span key={i}>{p.value}</span>
                  ),
                )}
            </p>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            {approved ? (
              <motion.p
                key="approved"
                data-testid="approval-status"
                initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
              >
                Approved
              </motion.p>
            ) : (
              <span className="text-sm text-muted-foreground">Awaiting teacher approval</span>
            )}
          </AnimatePresence>

          <Button size="lg" disabled={approved || approving} onClick={handleApprove}>
            {approved ? 'Approved' : approving ? 'Approving…' : 'Approve'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
