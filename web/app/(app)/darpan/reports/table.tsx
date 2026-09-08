'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileDown, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { generateReport, releaseReport, signedUrl } from '../actions';

interface Row { student_id: string; full_name: string; stage: string; domains: number; approved: number; drafted: number }
interface Report { id: string; student_id: string; file_path: string | null; generated_at: string | null; released_to_parent_at: string | null }

export function ReportsTable({ term, rows, reports }: { term: string; rows: Row[]; reports: Report[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<unknown>, ok?: string) => start(async () => { try { await fn(); if (ok) toast.success(ok); router.refresh(); } catch (e) { toast.error((e as Error).message); } });
  return (
    <div className="card-surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Child</th><th className="px-4 py-2 font-medium">Descriptors</th><th className="px-4 py-2 font-medium">Report</th><th className="px-4 py-2 font-medium">Parent</th><th className="px-4 py-2" /></tr></thead>
        <tbody>
          {rows.map((r) => {
            const rep = reports.find((x) => x.student_id === r.student_id);
            const ready = r.approved === r.domains;
            return (
              <tr key={r.student_id} className="border-t">
                <td className="px-4 py-2 font-medium">{r.full_name}<span className="block text-xs capitalize text-muted-foreground">{r.stage}</span></td>
                <td className={`px-4 py-2 tabular ${ready ? 'text-approved-foreground' : 'text-pending-foreground'}`}>{r.approved}/{r.domains} approved{r.drafted ? ` · ${r.drafted} draft` : ''}</td>
                <td className="px-4 py-2 text-xs">{rep?.generated_at ? `Generated ${new Date(rep.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : '—'}</td>
                <td className="px-4 py-2 text-xs">{rep?.released_to_parent_at ? <span className="rounded-full bg-approved px-2 py-0.5 text-approved-foreground">Released</span> : '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    {rep?.file_path && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(async () => { const u = await signedUrl('artifacts', rep.file_path!); window.open(u, '_blank', 'noopener'); })}><FileDown className="size-4" /> PDF</Button>}
                    {!rep?.generated_at || !rep.file_path ? (
                      <Button size="sm" disabled={pending || !ready} title={ready ? undefined : 'Approve every domain descriptor first — the database will refuse otherwise'} onClick={() => run(() => generateReport(r.student_id, term), 'Report generated')}>{pending ? <Loader2 className="size-4 animate-spin" /> : null} Generate</Button>
                    ) : !rep.released_to_parent_at ? (
                      <Button size="sm" disabled={pending} onClick={() => run(() => releaseReport(rep.id), 'Released to parent')}><Send className="size-4" /> Release to parent</Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
