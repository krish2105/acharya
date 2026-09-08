'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, FileDown, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { approvePaper, createImprovementPaper, importMarks, renderPaperPdfs, signedUrl } from '../../actions';

const FILES: { key: string; label: string }[] = [{ key: 'question', label: 'Question paper' }, { key: 'key', label: 'Answer key' }, { key: 'scheme', label: 'Marking scheme' }, { key: 'compliance', label: 'Compliance sheet' }];

export function PaperActions({ paperId, status, files, canApprove, hasShortfalls, isImprovement }: { paperId: string; status: string; files: Record<string, string>; canApprove: boolean; hasShortfalls: boolean; isImprovement: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const wrap = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  const hasFiles = Object.keys(files).length === 4;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasFiles ? (
        FILES.map((f) => (
          <Button key={f.key} size="sm" variant="outline" disabled={pending} onClick={() => wrap(async () => { const url = await signedUrl('papers', files[f.key]); window.open(url, '_blank', 'noopener'); })}>
            <FileDown className="size-4" /> {f.label}
          </Button>
        ))
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => wrap(() => renderPaperPdfs(paperId), 'Four PDFs rendered')}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} Export PDFs
        </Button>
      )}
      {!isImprovement && status === 'approved' && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => wrap(async () => { const id = await createImprovementPaper(paperId); router.push(`/prashna/papers/${id}`); }, 'Improvement paper assembled')}>
          <Copy className="size-4" /> Improvement paper
        </Button>
      )}
      <Dialog>
        <DialogTrigger render={<Button size="sm" variant="outline" />}><Upload className="size-4" /> Import marks</DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Import marks (CSV)</DialogTitle><DialogDescription>Columns: admission_no, q_no, marks_obtained. Calibration runs after import.</DialogDescription></DialogHeader>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.set('paper_id', paperId); wrap(async () => { const r = await importMarks(fd); toast.success(`${r.imported} responses imported, ${r.skipped} skipped, ${r.calibrated} items calibrated`); }); }}>
            <Input type="file" name="file" accept=".csv" required />
            <Button type="submit" disabled={pending}>Import</Button>
          </form>
        </DialogContent>
      </Dialog>
      {status !== 'approved' && status !== 'printed' && canApprove && (
        <Button size="sm" disabled={pending || hasShortfalls} title={hasShortfalls ? 'Resolve shortfalls first' : undefined} onClick={() => wrap(() => approvePaper(paperId), 'Paper approved')}>
          <Check className="size-4" /> Approve paper
        </Button>
      )}
    </div>
  );
}
