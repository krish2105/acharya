'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { assessProject, signedUrl } from '../actions';
import { RUBRIC } from '../nav';

interface P { id: string; title: string | null; artefact_path: string | null; rubric_scores: Record<string, number> | null; teacher_comment: string | null; assessed_on: string | null; students: { full_name: string; sections: { grade: string; section: string } | null } | null; ct_ai_units: { title: string } | null }

export function ProjectsTable({ rows }: { rows: P[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="card-surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Student</th><th className="px-4 py-2 font-medium">Project</th><th className="px-4 py-2 font-medium">Rubric</th><th className="px-4 py-2 font-medium">Comment</th><th className="px-4 py-2" /></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t align-top">
              <td className="px-4 py-2 font-medium">{p.students?.full_name}<span className="block text-xs text-muted-foreground">Grade {p.students?.sections?.grade}{p.students?.sections?.section}</span></td>
              <td className="px-4 py-2">{p.title ?? '—'}<span className="block text-xs text-muted-foreground">{p.ct_ai_units?.title}</span></td>
              <td className="px-4 py-2 text-xs tabular">{p.rubric_scores ? RUBRIC.map(([k, l]) => <span key={k} className="mr-2">{l.split(' ')[0]} {p.rubric_scores![k] ?? '—'}</span>) : <span className="text-pending-foreground">not assessed</span>}</td>
              <td className="max-w-xs px-4 py-2 text-xs text-muted-foreground">{p.teacher_comment ?? '—'}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  {p.artefact_path && <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { try { const u = await signedUrl('projects', p.artefact_path!); window.open(u, '_blank', 'noopener'); } catch (e) { toast.error((e as Error).message); } })}><FileDown className="size-4" /></Button>}
                  <Dialog>
                    <DialogTrigger render={<Button size="sm" variant={p.assessed_on ? 'outline' : 'default'} />}>{p.assessed_on ? 'Re-assess' : 'Assess'}</DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Assess · {p.students?.full_name}</DialogTitle></DialogHeader>
                      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const scores: Record<string, number> = {}; for (const [k] of RUBRIC) scores[k] = Number(fd.get(k)); start(async () => { try { await assessProject(p.id, scores, String(fd.get('comment') ?? '')); toast.success('Assessment saved'); router.refresh(); } catch (err) { toast.error((err as Error).message); } }); }}>
                        {RUBRIC.map(([k, l]) => (
                          <label key={k} className="flex items-center justify-between gap-3 text-sm"><span>{l}</span>
                            <select name={k} defaultValue={String(p.rubric_scores?.[k] ?? 2)} className="h-9 rounded-lg border bg-card px-2 text-sm">{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{['Beginning', 'Developing', 'Proficient', 'Exemplary'][n - 1]} ({n})</option>)}</select>
                          </label>
                        ))}
                        <Textarea name="comment" rows={3} placeholder="Specific comment for the student" defaultValue={p.teacher_comment ?? ''} required />
                        <Button type="submit" disabled={pending}>Save assessment</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
