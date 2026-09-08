'use client';

import { useMemo, useState, useTransition } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ConceptRow } from '@/lib/setu/types';
import { createConcept } from '../actions';

export function ConceptTree({ concepts, subjects, counts }: { concepts: ConceptRow[]; subjects: { id: string; name: string }[]; counts: Record<string, { confirmed: number; pending: number }> }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const reduced = useReducedMotion();
  const roots = useMemo(() => concepts.filter((c) => !c.parent_id), [concepts]);
  const children = useMemo(() => {
    const m = new Map<string, ConceptRow[]>();
    for (const c of concepts) if (c.parent_id) m.set(c.parent_id, [...(m.get(c.parent_id) ?? []), c]);
    return m;
  }, [concepts]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <NewConceptDialog subjects={subjects} roots={roots} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {roots.map((root) => {
          const kids = children.get(root.id) ?? [];
          const isOpen = open[root.id] ?? true;
          return (
            <section key={root.id} className="card-surface overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [root.id]: !isOpen }))}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40"
              >
                <ChevronRight className={`size-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                <span className="font-display text-lg font-medium">{root.title.replace(' (root)', '')}</span>
                <span className="ml-auto tabular text-xs text-muted-foreground">{kids.length} concepts</span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.ul
                    initial={reduced ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduced ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden border-t"
                  >
                    {kids.map((c) => {
                      const n = counts[c.id];
                      return (
                        <li key={c.id} className="flex items-center gap-3 border-b px-4 py-2 text-sm last:border-b-0">
                          <span className="flex-1">{c.title}</span>
                          {c.stage && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] capitalize text-secondary-foreground">{c.stage}</span>}
                          <span className="tabular text-xs text-approved-foreground">{n?.confirmed ?? 0} confirmed</span>
                          {n?.pending ? <span className="tabular text-xs text-pending-foreground">{n.pending} pending</span> : null}
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function NewConceptDialog({ subjects, roots }: { subjects: { id: string; name: string }[]; roots: ConceptRow[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" /> New concept
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New canonical concept</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              try {
                await createConcept({
                  title: String(fd.get('title')),
                  description: String(fd.get('description') ?? ''),
                  subjectId: String(fd.get('subject') || '') || null,
                  parentId: String(fd.get('parent') || '') || null,
                  stage: String(fd.get('stage') || '') || null,
                });
                toast.success('Concept created');
                setOpen(false);
              } catch (err) {
                toast.error((err as Error).message);
              }
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="e.g. Photosynthesis: light-dependent reactions" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subject">Subject</Label>
              <select id="subject" name="subject" className="h-9 rounded-lg border bg-card px-2 text-sm">
                <option value="">—</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="parent">Parent</Label>
              <select id="parent" name="parent" className="h-9 rounded-lg border bg-card px-2 text-sm">
                <option value="">—</option>
                {roots.map((r) => (
                  <option key={r.id} value={r.id}>{r.title.replace(' (root)', '')}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stage">Stage</Label>
              <select id="stage" name="stage" className="h-9 rounded-lg border bg-card px-2 text-sm">
                <option value="">—</option>
                {['preparatory', 'middle', 'secondary'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Create'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
