'use client';

import { useState, useTransition } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { importOutcomes } from '../actions';

export function ImportDialog({ frameworks, subjects, defaultOpen }: { frameworks: { id: string; code: string; name: string }[]; subjects: { id: string; code: string; name: string }[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [pending, start] = useTransition();
  const [isPdf, setIsPdf] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload className="size-4" /> Import framework
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import outcome set</DialogTitle>
          <DialogDescription>
            CSV/XLSX columns: framework_code, subject_code, grade, ref_code, statement, cognitive_level (headers are mapped loosely). PDF import
            extracts lines shaped like <code className="font-mono">REF.CODE statement</code> and needs a framework and subject.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              try {
                const r = await importOutcomes(fd);
                toast.success(`Imported ${r.upserted} outcomes (${r.skipped} skipped), ${r.embedded} embedded`);
                setOpen(false);
              } catch (err) {
                toast.error((err as Error).message);
              }
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">File</Label>
            <Input id="file" name="file" type="file" accept=".csv,.xlsx,.pdf" required onChange={(e) => setIsPdf(!!e.target.files?.[0]?.name.toLowerCase().endsWith('.pdf'))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source_document">Source document</Label>
            <Input id="source_document" name="source_document" required placeholder="e.g. Board curriculum framework 2026 (synthetic)" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="framework_code">Framework {isPdf && '*'}</Label>
              <select id="framework_code" name="framework_code" required={isPdf} className="h-9 rounded-lg border bg-card px-2 text-sm">
                <option value="">From file</option>
                {frameworks.map((f) => (
                  <option key={f.id} value={f.code}>{f.code}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subject_code">Subject {isPdf && '*'}</Label>
              <select id="subject_code" name="subject_code" required={isPdf} className="h-9 rounded-lg border bg-card px-2 text-sm">
                <option value="">From file</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grade">Grade</Label>
              <Input id="grade" name="grade" placeholder="From file" />
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {pending ? 'Importing & embedding…' : 'Import'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
