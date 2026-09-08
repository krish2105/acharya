'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { attachOutcome, detachOutcome } from '../../actions';

interface O { id: string; ref_code: string; statement: string; grade: string; frameworks: { code: string } | null }

export function UnitOutcomesEditor({ unitId, attached, candidates, q }: { unitId: string; attached: O[]; candidates: O[]; q: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const attachedIds = new Set(attached.map((a) => a.id));

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card-surface overflow-hidden">
        <h3 className="border-b px-5 py-3 text-sm font-medium text-muted-foreground">Attached outcomes ({attached.length})</h3>
        {attached.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">No outcomes attached yet. Add from the right.</p>}
        <ul>
          {attached.map((o) => (
            <li key={o.id} className="flex items-start gap-3 border-b px-5 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <OutcomeChip size="sm" outcome={{ frameworkCode: o.frameworks?.code ?? '', refCode: o.ref_code, statement: o.statement }} />
                <p className="mt-1 text-sm">{o.statement}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Remove" disabled={pending} onClick={() => run(() => detachOutcome(unitId, o.id))}>
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-surface overflow-hidden">
        <div className="border-b px-5 py-3">
          <Input
            defaultValue={q}
            placeholder="Search any framework's outcomes…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.replace(`?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
            }}
          />
        </div>
        <ul>
          {candidates.filter((c) => !attachedIds.has(c.id)).map((o) => (
            <li key={o.id} className="flex items-start gap-3 border-b px-5 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <OutcomeChip size="sm" outcome={{ frameworkCode: o.frameworks?.code ?? '', refCode: o.ref_code, statement: o.statement }} />
                <p className="mt-1 text-sm">{o.statement}</p>
                <p className="text-xs text-muted-foreground">Grade {o.grade}</p>
              </div>
              <Button size="icon" variant="outline" aria-label="Attach" disabled={pending} onClick={() => run(() => attachOutcome(unitId, o.id))}>
                <Plus className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
