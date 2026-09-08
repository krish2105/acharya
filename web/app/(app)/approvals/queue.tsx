'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { ApprovalCard } from '@/components/shared/approval-card';
import type { Outcome } from '@/components/shared/outcome-chip';
import { useRegisterCommands } from '@/components/shell/command-palette';
import { Kbd } from '@/components/ui/kbd';
import { useT } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';
import { approveDescriptor } from '../darpan/actions';
import { approveItem, rejectItem } from '../prashna/actions';
import { approveArtifactAction } from '../saarthi/actions';

export interface QueueEntry {
  id: string;
  type: 'item' | 'artifact' | 'descriptor';
  title: string;
  meta: string;
  outcome: Outcome;
  generated: string;
  final: string;
  href: string;
}

const TYPE_LABEL = { item: 'Item', artifact: 'Artifact', descriptor: 'Descriptor' } as const;

export function ApprovalsQueue({ entries: initial }: { entries: QueueEntry[] }) {
  const { t } = useT();
  const [entries, setEntries] = useState(initial);
  const [idx, setIdx] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const current = entries[idx];

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((x) => x.id !== id);
      setIdx((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  }, []);

  const approve = useCallback(() => {
    if (!current || pending) return;
    start(async () => {
      try {
        if (current.type === 'item') await approveItem(current.id);
        else if (current.type === 'artifact') await approveArtifactAction(current.id);
        else await approveDescriptor(current.id, current.final);
        toast.success(`${TYPE_LABEL[current.type]} approved`);
        remove(current.id);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }, [current, pending, remove]);

  const reject = useCallback(() => {
    if (!current || pending) return;
    if (current.type !== 'item') {
      toast.info('Open the draft to edit or discard it');
      return;
    }
    start(async () => {
      try {
        await rejectItem(current.id, 'Rejected from the approval queue');
        toast.success('Item rejected');
        remove(current.id);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }, [current, pending, remove]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setIdx((i) => Math.min(i + 1, entries.length - 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setIdx((i) => Math.max(i - 1, 0));
          break;
        case 'a':
        case 'A':
          approve();
          break;
        case 'r':
        case 'R':
          reject();
          break;
        case 'Enter':
          if (current) router.push(current.href);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entries.length, approve, reject, current, router]);

  useRegisterCommands([
    { id: 'approvals-approve', label: 'Approve current draft', group: 'Approvals', shortcut: 'A', onSelect: approve },
    { id: 'approvals-reject', label: 'Reject current draft', group: 'Approvals', shortcut: 'R', onSelect: reject },
  ]);

  if (entries.length === 0) return <div className="card-surface p-10 text-center text-sm text-muted-foreground">{t('approvals.empty')}</div>;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
      <aside className="card-surface flex max-h-[70vh] flex-col overflow-hidden">
        <p className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2 text-[11px] text-muted-foreground">
          <Kbd>j</Kbd><Kbd>k</Kbd> move · <Kbd>A</Kbd> approve · <Kbd>R</Kbd> reject · <Kbd>↵</Kbd> open
        </p>
        <ol className="flex-1 overflow-y-auto p-1.5">
          {entries.map((e, i) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setIdx(i)}
                aria-current={i === idx ? 'true' : undefined}
                className={cn('relative flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent', i === idx && 'text-primary')}
              >
                {i === idx && <motion.span layoutId="queue-active" aria-hidden className="absolute inset-0 rounded-lg bg-primary-soft" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                <span className="relative flex items-center gap-2">
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-navy">{TYPE_LABEL[e.type]}</span>
                  <span className="truncate font-medium">{e.title}</span>
                </span>
                <span className="relative truncate text-xs text-muted-foreground">{e.meta}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <section className="min-w-0">
        {current && (
          <div className="flex flex-col gap-3">
            <ApprovalCard
              key={current.id}
              title={current.title}
              outcome={current.outcome}
              generatedText={current.generated}
              finalText={current.final}
              approved={false}
              meta={current.meta}
              onApprove={approve}
              onReject={reject}
            />
            <Link href={current.href} className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
              {t('approvals.open')} <ArrowUpRight className="size-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
