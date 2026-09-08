'use client';

import { useState, useTransition } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { renderEvidencePack, signedUrl } from './actions';

export function EvidencePackButton({ grades }: { grades: string[] }) {
  const [grade, setGrade] = useState(grades.includes('6') ? '6' : grades[0] ?? '6');
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="Grade">
        {(grades.length ? grades : ['3', '4', '5', '6', '7', '8']).map((g) => <option key={g} value={g}>Grade {g}</option>)}
      </select>
      <Button disabled={pending} onClick={() => start(async () => { try { const p = await renderEvidencePack(grade); const u = await signedUrl('cpd', p); window.open(u, '_blank', 'noopener'); } catch (e) { toast.error((e as Error).message); } })}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} Evidence pack PDF
      </Button>
    </div>
  );
}
