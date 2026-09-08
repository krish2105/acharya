'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { StatusPill } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import type { PendingLink } from '@/lib/setu/types';
import { cn } from '@/lib/utils';
import { bulkConfirmLinks, confirmLink, rejectLink } from '../actions';

const key = (l: PendingLink) => `${l.learning_outcome_id}:${l.concept_id}`;

export function AlignmentQueue({ items: initial, canConfirm }: { items: PendingLink[]; canConfirm: boolean }) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const reduced = useReducedMotion();
  const listRef = useRef<HTMLUListElement>(null);

  const remove = (k: string) => {
    setItems((prev) => prev.filter((i) => key(i) !== k));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(k);
      return n;
    });
    setCursor((c) => Math.max(0, Math.min(c, items.length - 2)));
  };

  const act = (l: PendingLink, kind: 'confirm' | 'reject') => {
    if (!canConfirm) {
      toast.error('Only academic heads, board coordinators and HODs can confirm links.');
      return;
    }
    const k = key(l);
    remove(k);
    start(async () => {
      try {
        if (kind === 'confirm') await confirmLink(l.learning_outcome_id, l.concept_id);
        else await rejectLink(l.learning_outcome_id, l.concept_id);
      } catch (e) {
        toast.error((e as Error).message);
        setItems((prev) => [l, ...prev]);
      }
    });
  };

  const confirmSelected = () => {
    const chosen = items.filter((i) => selected.has(key(i)));
    if (!chosen.length) return;
    chosen.forEach((c) => remove(key(c)));
    start(async () => {
      try {
        await bulkConfirmLinks(chosen.map((c) => ({ outcomeId: c.learning_outcome_id, conceptId: c.concept_id })));
        toast.success(`Confirmed ${chosen.length} links`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const cur = items[cursor];
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      else if (e.key === 'a' && cur) act(cur, 'confirm');
      else if (e.key === 'A' && e.shiftKey) confirmSelected();
      else if (e.key === 'r' && cur) act(cur, 'reject');
      else if (e.key === ' ' && cur) {
        e.preventDefault();
        setSelected((s) => {
          const n = new Set(s);
          const k = key(cur);
          if (n.has(k)) n.delete(k);
          else n.add(k);
          return n;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p className="tabular">
          {items.length} proposed · {selected.size} selected {pending && '· saving…'}
        </p>
        <div className="flex items-center gap-2">
          <Kbd>J</Kbd>/<Kbd>K</Kbd> move <Kbd>A</Kbd> confirm <Kbd>R</Kbd> reject <Kbd>Space</Kbd> select
          <Button size="sm" variant="outline" disabled={selected.size === 0} onClick={confirmSelected}>
            Confirm selected (⇧A)
          </Button>
        </div>
      </div>

      <ul ref={listRef} className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((l, i) => {
            const k = key(l);
            const active = i === cursor;
            return (
              <motion.li
                key={k}
                layout
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: 24, transition: { duration: 0.18 } }}
                onClick={() => setCursor(i)}
                className={cn(
                  'card-surface grid cursor-pointer grid-cols-[auto_1fr_auto_1fr_auto] items-start gap-4 p-4 transition-shadow',
                  active && 'ring-2 ring-primary/40 shadow-glow',
                  selected.has(k) && 'bg-primary-soft/40',
                )}
              >
                <input
                  type="checkbox"
                  aria-label="Select"
                  checked={selected.has(k)}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (n.has(k)) n.delete(k);
                      else n.add(k);
                      return n;
                    })
                  }
                  className="mt-1 accent-primary"
                />
                <div className="min-w-0">
                  <OutcomeChip size="sm" outcome={{ frameworkCode: l.outcome?.frameworks?.code ?? '', refCode: l.outcome?.ref_code ?? '', statement: l.outcome?.statement ?? '' }} />
                  <p className="mt-1.5 text-sm">{l.outcome?.statement}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Grade {l.outcome?.grade}</p>
                </div>
                <div className="flex flex-col items-center gap-1 pt-1 text-xs text-muted-foreground">
                  <span className="tabular font-medium text-foreground">{l.confidence != null ? `${Math.round(Number(l.confidence) * 100)}%` : '—'}</span>
                  <StatusPill status={l.method} label={l.method === 'llm_suggested' ? 'LLM' : 'Embedding'} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{l.concept?.title}</p>
                  {l.concept?.description && <p className="mt-1 text-xs text-muted-foreground">{l.concept.description}</p>}
                  {l.justification && <p className="mt-1 text-xs italic text-muted-foreground">{l.justification}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" aria-label="Reject" onClick={(e) => { e.stopPropagation(); act(l, 'reject'); }}>
                    <X className="size-4" />
                  </Button>
                  <Button size="icon" aria-label="Confirm" onClick={(e) => { e.stopPropagation(); act(l, 'confirm'); }}>
                    <Check className="size-4" />
                  </Button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
