'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { createParentToken, submitTeacherInput } from '../actions';

const SOURCES = ['self', 'peer', 'parent', 'teacher'] as const;
const TEACHER_FIELDS = [['participation', 'Participation'], ['homework', 'Homework habits'], ['collaboration', 'Collaboration'], ['note', 'One specific note']];

export function InputsMatrix({ term, students, inputs, consents }: { term: string; students: { id: string; full_name: string }[]; inputs: { student_id: string; source: string }[]; consents: { student_id: string; purpose: string; granted: boolean; withdrawn_at: string | null }[] }) {
  const [pending, start] = useTransition();
  const [links, setLinks] = useState<Record<string, string>>({});
  const router = useRouter();
  const has = (sid: string, src: string) => inputs.some((i) => i.student_id === sid && i.source === src);
  const consent = (sid: string) => consents.some((c) => c.student_id === sid && c.purpose === 'parent_input' && c.granted && !c.withdrawn_at);

  return (
    <div className="card-surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Child</th>{SOURCES.map((s) => <th key={s} className="px-4 py-2 font-medium capitalize">{s}</th>)}<th className="px-4 py-2 font-medium">Actions</th></tr></thead>
        <tbody>
          {students.map((st) => (
            <tr key={st.id} className="border-t">
              <td className="px-4 py-2 font-medium">{st.full_name}</td>
              {SOURCES.map((s) => <td key={s} className="px-4 py-2">{has(st.id, s) ? <span className="inline-flex items-center gap-1 text-approved-foreground"><Check className="size-4" /> in</span> : <span className="text-muted-foreground">—</span>}</td>)}
              <td className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {links[st.id] ? (
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${location.origin}${links[st.id]}`); toast.success('Link copied'); }}><Copy className="size-4" /> Copy parent link</Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={pending || !consent(st.id)} title={consent(st.id) ? undefined : 'No parent_input consent on file'} onClick={() => start(async () => { try { const l = await createParentToken(st.id, term); setLinks((x) => ({ ...x, [st.id]: l })); } catch (e) { toast.error((e as Error).message); } })}>
                      <Link2 className="size-4" /> Parent link
                    </Button>
                  )}
                  {!has(st.id, 'teacher') && (
                    <Dialog>
                      <DialogTrigger render={<Button size="sm" />}>Teacher input</DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Teacher input · {st.full_name}</DialogTitle></DialogHeader>
                        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const r: Record<string, string> = {}; for (const [k] of TEACHER_FIELDS) r[k] = String(fd.get(k) ?? ''); start(async () => { try { await submitTeacherInput(st.id, term, r); toast.success('Saved'); router.refresh(); } catch (err) { toast.error((err as Error).message); } }); }}>
                          {TEACHER_FIELDS.map(([k, l]) => <label key={k} className="flex flex-col gap-1 text-sm"><span className="text-xs text-muted-foreground">{l}</span><Textarea name={k} rows={2} required /></label>)}
                          <Button type="submit" disabled={pending}>Save</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
