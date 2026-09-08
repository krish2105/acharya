'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logHours } from '../actions';

export function HoursForm({ sections, activities }: { sections: { id: string; grade: string; label: string }[]; activities: { id: string; label: string; grade: string }[] }) {
  const [pending, start] = useTransition();
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const router = useRouter();
  const grade = sections.find((s) => s.id === sectionId)?.grade;
  return (
    <form className="card-surface flex flex-col gap-3 self-start p-5" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const form = e.currentTarget; start(async () => { try { await logHours(fd); toast.success('Session logged'); form.reset(); router.refresh(); } catch (err) { toast.error((err as Error).message); } }); }}>
      <h3 className="font-display text-lg font-medium">Log a session</h3>
      <div className="flex flex-col gap-1.5"><Label htmlFor="section_id">Section</Label><select id="section_id" name="section_id" value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="h-9 rounded-lg border bg-card px-2 text-sm">{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="activity_id">Activity</Label><select id="activity_id" name="activity_id" className="h-9 rounded-lg border bg-card px-2 text-sm"><option value="">— (free session)</option>{activities.filter((a) => !grade || a.grade === grade).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="delivered_on">Date</Label><Input id="delivered_on" name="delivered_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="minutes">Minutes</Label><Input id="minutes" name="minutes" type="number" min={5} max={240} defaultValue={40} required /></div>
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="note">Note</Label><Input id="note" name="note" placeholder="optional" /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="evidence">Evidence (photo / file)</Label><Input id="evidence" name="evidence" type="file" accept="image/*,.pdf" /></div>
      <Button type="submit" disabled={pending || !sectionId}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Log session</Button>
    </form>
  );
}
