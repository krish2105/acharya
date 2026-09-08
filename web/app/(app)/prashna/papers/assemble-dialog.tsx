'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { assemblePaper } from '../actions';
import { EXAM_KINDS, label } from '../nav';

export function AssembleDialog({ blueprints, sections, defaultOpen }: { blueprints: { id: string; label: string; grade: string }[]; sections: { id: string; label: string }[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}><Wand2 className="size-4" /> Assemble paper</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assemble a paper</DialogTitle>
          <DialogDescription>Selects approved items satisfying the blueprint&apos;s sections, marks, competency share and Bloom mix. If the bank cannot fill a slot, the exact shortfall is reported.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              try {
                const id = await assemblePaper({ blueprintId: String(fd.get('blueprint')), sectionId: String(fd.get('section') || '') || null, title: String(fd.get('title')), examKind: String(fd.get('kind')), scheduledOn: String(fd.get('date') || '') || null });
                setOpen(false);
                router.push(`/prashna/papers/${id}`);
              } catch (err) {
                toast.error((err as Error).message);
              }
            });
          }}
        >
          <div className="flex flex-col gap-1.5"><Label htmlFor="title">Title</Label><Input id="title" name="title" required placeholder="e.g. Preboard 1 — Science 10A" /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="blueprint">Blueprint</Label><select id="blueprint" name="blueprint" className="h-9 rounded-lg border bg-card px-2 text-sm">{blueprints.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="section">Section</Label><select id="section" name="section" className="h-9 rounded-lg border bg-card px-2 text-sm"><option value="">—</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="kind">Kind</Label><select id="kind" name="kind" className="h-9 rounded-lg border bg-card px-2 text-sm capitalize">{EXAM_KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="date">Date</Label><Input id="date" name="date" type="date" /></div>
          </div>
          <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} {pending ? 'Solving…' : 'Assemble'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
