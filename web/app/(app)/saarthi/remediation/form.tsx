'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { buildRemediation } from '../actions';

export function RemediationForm({ sections, subjects }: { sections: { id: string; label: string }[]; subjects: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ artifact_id: string; weak: number; from_bank: number; generated: number; needs_generation: string[] } | null>(null);
  return (
    <form
      className="card-surface flex max-w-xl flex-col gap-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            const r = await buildRemediation({ sectionId: String(fd.get('section')), subjectId: String(fd.get('subject') || '') || null, generateForGaps: fd.get('generate') === 'on', language: String(fd.get('language')) });
            setResult(r);
            toast.success(`${r.weak} weak outcomes · ${r.from_bank} from the bank · ${r.generated} generated`);
          } catch (err) {
            toast.error((err as Error).message);
          }
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="section">Section</Label><select id="section" name="section" className="h-9 rounded-lg border bg-card px-2 text-sm">{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="subject">Subject</Label><select id="subject" name="subject" className="h-9 rounded-lg border bg-card px-2 text-sm"><option value="">All</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="generate" defaultChecked className="accent-primary" /> Generate practice for outcomes with an empty bank</label>
        <select name="language" className="h-9 rounded-lg border bg-card px-2 text-sm"><option value="en">English</option><option value="hi">हिन्दी</option></select>
      </div>
      <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Build remediation set</Button>
      {result && (
        <p className="rounded-lg bg-approved px-3 py-2 text-sm text-approved-foreground">
          Built for {result.weak} weak outcomes: {result.from_bank} from the approved bank, {result.generated} generated{result.needs_generation.length ? `, ${result.needs_generation.length} still need items` : ''}. <Link className="underline" href={`/saarthi/history/${result.artifact_id}`}>Open</Link>
        </p>
      )}
    </form>
  );
}
