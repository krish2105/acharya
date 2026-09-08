'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addCpd } from '../actions';

export function CpdForm({ teachers }: { teachers: { id: string; full_name: string }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="card-surface flex flex-col gap-3 self-start p-5" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const form = e.currentTarget; start(async () => { try { await addCpd(fd); toast.success('CPD record added'); form.reset(); router.refresh(); } catch (err) { toast.error((err as Error).message); } }); }}>
      <h3 className="font-display text-lg font-medium">Add a CPD record</h3>
      <div className="flex flex-col gap-1.5"><Label htmlFor="teacher_id">Teacher</Label><select id="teacher_id" name="teacher_id" className="h-9 rounded-lg border bg-card px-2 text-sm">{teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="activity">Activity</Label><select id="activity" name="activity" className="h-9 rounded-lg border bg-card px-2 text-sm">{['District Level Deliberation', 'CBSE CoE workshop', 'in-house'].map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="hours">Hours</Label><Input id="hours" name="hours" type="number" min={0.5} step={0.5} defaultValue={3} required /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="completed_on">Completed</Label><Input id="completed_on" name="completed_on" type="date" /></div>
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="certificate">Certificate (PDF/image)</Label><Input id="certificate" name="certificate" type="file" accept=".pdf,image/*" /></div>
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Add record'}</Button>
    </form>
  );
}
