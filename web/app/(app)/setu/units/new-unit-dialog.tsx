'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createUnit } from '../actions';

export function NewUnitDialog({ frameworks, subjects }: { frameworks: { id: string; code: string }[]; subjects: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" /> New unit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New unit of work</DialogTitle></DialogHeader>
        <form
          className="grid grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              try {
                const id = await createUnit({
                  title: String(fd.get('title')), subjectId: String(fd.get('subject') || '') || null, grade: String(fd.get('grade')),
                  frameworkId: String(fd.get('framework')), plannedHours: Number(fd.get('hours')) || null,
                  sequenceNo: Number(fd.get('seq')) || null, academicYear: String(fd.get('year')),
                });
                setOpen(false);
                router.push(`/setu/units/${id}`);
              } catch (err) {
                toast.error((err as Error).message);
              }
            });
          }}
        >
          <div className="col-span-2 flex flex-col gap-1.5"><Label htmlFor="title">Title</Label><Input id="title" name="title" required /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="framework">Framework</Label>
            <select id="framework" name="framework" required className="h-9 rounded-lg border bg-card px-2 text-sm">{frameworks.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}</select></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="subject">Subject</Label>
            <select id="subject" name="subject" className="h-9 rounded-lg border bg-card px-2 text-sm"><option value="">—</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="grade">Grade</Label><Input id="grade" name="grade" required placeholder="9" /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="year">Academic year</Label><Input id="year" name="year" defaultValue="2026-27" required /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="hours">Planned hours</Label><Input id="hours" name="hours" type="number" min={0} step={0.5} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="seq">Sequence no.</Label><Input id="seq" name="seq" type="number" min={1} /></div>
          <Button className="col-span-2" type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create unit'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
