'use client';

import { useState, useTransition } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { generateTransitionReport, signedUrl } from '../actions';

interface Report { id: string; target_grade: string; gaps: { gaps: { ref_code: string; statement: string; subject: string }[]; compared_outcomes: number; not_comparable_subjects: string[] }; file_path: string | null; generated_at: string; students: { full_name: string; admission_no: string } | null; from: { code: string } | null; to: { code: string } | null }
interface Student { id: string; full_name: string; admission_no: string; frameworks: { code: string } | null }

export function TransitionsView({ reports, students, frameworks }: { reports: Report[]; students: Student[]; frameworks: { code: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(reports[0]?.id ?? null);

  const download = (path: string) =>
    start(async () => {
      try {
        const url = await signedUrl('artifacts', path);
        window.open(url, '_blank', 'noopener');
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <form
        className="card-surface flex flex-col gap-4 p-5 self-start"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            try {
              await generateTransitionReport(String(fd.get('student')), String(fd.get('to')), String(fd.get('grade')));
              toast.success('Report generated');
            } catch (err) {
              toast.error((err as Error).message);
            }
          });
        }}
      >
        <h3 className="font-display text-lg font-medium">Generate a report</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="student">Student (with a previous board)</Label>
          <select id="student" name="student" required className="h-9 rounded-lg border bg-card px-2 text-sm">
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name} · {s.admission_no} (from {s.frameworks?.code})</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to">Target board</Label>
            <select id="to" name="to" required defaultValue="CBSE" className="h-9 rounded-lg border bg-card px-2 text-sm">
              {frameworks.map((f) => (
                <option key={f.code} value={f.code}>{f.code}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grade">Target grade</Label>
            <select id="grade" name="grade" required defaultValue="9" className="h-9 rounded-lg border bg-card px-2 text-sm">
              {['6', '7', '8', '9', '10', '11', '12'].map((g) => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>
        </div>
        <Button type="submit" disabled={pending || students.length === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Generate gap report
        </Button>
        <p className="text-xs text-muted-foreground">Only human-confirmed links count. The report is a planning aid, never a grade or a prediction.</p>
      </form>

      <section className="flex flex-col gap-3">
        {reports.length === 0 && <div className="card-surface p-10 text-center text-sm text-muted-foreground">No reports yet.</div>}
        {reports.map((r) => {
          const open = openId === r.id;
          return (
            <article key={r.id} className="card-surface overflow-hidden">
              <button type="button" onClick={() => setOpenId(open ? null : r.id)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.students?.full_name} <span className="text-xs text-muted-foreground">{r.students?.admission_no}</span></p>
                  <p className="text-xs text-muted-foreground">{r.from?.code} → {r.to?.code} Grade {r.target_grade} · {new Date(r.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium tabular ${r.gaps.gaps.length ? 'bg-pending text-pending-foreground' : 'bg-approved text-approved-foreground'}`}>
                  {r.gaps.gaps.length} gaps of {r.gaps.compared_outcomes}
                </span>
                {r.file_path && (
                  <Button size="sm" variant="outline" disabled={pending} onClick={(e) => { e.stopPropagation(); download(r.file_path!); }}>
                    <FileDown className="size-4" /> PDF
                  </Button>
                )}
              </button>
              {open && (
                <div className="border-t px-5 py-4">
                  <ul className="flex flex-col gap-2">
                    {r.gaps.gaps.map((g) => (
                      <li key={g.ref_code} className="flex gap-3 text-sm">
                        <span className="font-mono text-xs text-primary whitespace-nowrap">{g.ref_code}</span>
                        <span className="flex-1">{g.statement}</span>
                        <span className="text-xs text-muted-foreground">{g.subject}</span>
                      </li>
                    ))}
                  </ul>
                  {r.gaps.not_comparable_subjects.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">Not comparable (no {r.from?.code} coverage to map against): {r.gaps.not_comparable_subjects.join(', ')}.</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
