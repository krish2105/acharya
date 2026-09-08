'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { markTaught } from '../actions';

export function CoverageControls({ sections, current }: { sections: { id: string; label: string }[]; current: string }) {
  const router = useRouter();
  return (
    <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={current} onChange={(e) => router.push(`/setu/coverage?section=${e.target.value}`)} aria-label="Section">
      {sections.map((s) => (
        <option key={s.id} value={s.id}>{s.label}</option>
      ))}
    </select>
  );
}

export function MarkTaughtButton({ outcomeId, sectionId, year }: { outcomeId: string; sectionId: string; year: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await markTaught(outcomeId, sectionId, year);
          } catch (e) {
            toast.error((e as Error).message);
          }
        })
      }
    >
      Mark taught today
    </Button>
  );
}
