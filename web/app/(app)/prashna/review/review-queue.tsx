'use client';

import { useEffect, useState, useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { ApprovalCard } from '@/components/shared/approval-card';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Textarea } from '@/components/ui/textarea';
import { approveItem, rejectItem, requestChanges } from '../actions';
import { label } from '../nav';

interface Item {
  id: string; stem: string; item_type: string; marks: number; cognitive_level: string; difficulty_intended: string | null; grade: string;
  subjects: { name: string } | null; frameworks: { code: string } | null; profiles: { full_name: string } | null;
  item_outcomes: { learning_outcomes: { ref_code: string; statement: string; frameworks: { code: string } | null } | null }[];
  item_versions: { version: number; body: { stem?: string } }[];
}

export function ReviewQueue({ items: initial }: { items: Item[] }) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(0);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const reduced = useReducedMotion();
  const current = items[cursor];

  const run = (fn: () => Promise<void>, id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setCursor((c) => Math.max(0, Math.min(c, items.length - 2)));
    start(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (!current) return;
      if (e.key === 'j' || e.key === 'ArrowDown') setCursor((c) => Math.min(c + 1, items.length - 1));
      else if (e.key === 'k' || e.key === 'ArrowUp') setCursor((c) => Math.max(c - 1, 0));
      else if (e.key === 'a') run(() => approveItem(current.id).then(() => { toast.success('Approved'); }), current.id);
      else if (e.key === 'c') run(() => requestChanges(current.id, note || 'Please revise.'), current.id);
      else if (e.key === 'r') run(() => rejectItem(current.id, note || 'Rejected.'), current.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!current) return <div className="card-surface p-10 text-center text-sm text-muted-foreground">Queue cleared.</div>;

  const first = current.item_versions.sort((a, b) => a.version - b.version);
  const generated = first[0]?.body?.stem ?? current.stem;
  const outcome = current.item_outcomes[0]?.learning_outcomes;

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <aside className="card-surface self-start overflow-hidden">
        <p className="border-b px-4 py-2 text-xs text-muted-foreground tabular">{items.length} pending · <Kbd>J</Kbd>/<Kbd>K</Kbd> <Kbd>A</Kbd> <Kbd>C</Kbd> <Kbd>R</Kbd></p>
        <ul className="max-h-[70vh] overflow-y-auto">
          {items.map((i, idx) => (
            <li key={i.id}>
              <button type="button" onClick={() => setCursor(idx)} className={`block w-full border-b px-4 py-2 text-left text-xs hover:bg-accent ${idx === cursor ? 'bg-primary-soft' : ''}`}>
                <span className="font-mono text-primary">{i.item_outcomes[0]?.learning_outcomes?.ref_code}</span>
                <span className="block truncate">{i.stem}</span>
                <span className="text-muted-foreground capitalize">{label(i.item_type)} · {i.marks}m · {i.profiles?.full_name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex flex-col gap-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={current.id} initial={reduced ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? undefined : { opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
            <ApprovalCard
              title={`${label(current.item_type)} · ${current.marks} marks · ${current.cognitive_level} · Grade ${current.grade} ${current.subjects?.name ?? ''}`}
              outcome={{ frameworkCode: outcome?.frameworks?.code ?? current.frameworks?.code ?? '', refCode: outcome?.ref_code ?? '', statement: outcome?.statement ?? '' }}
              generatedText={generated}
              finalText={current.stem}
              approved={false}
              meta={`Submitted by ${current.profiles?.full_name ?? 'teacher'} · ${first.length} version${first.length === 1 ? '' : 's'}`}
              onApprove={() => new Promise<void>((resolve) => { run(() => approveItem(current.id).then(() => { toast.success('Approved into the shared bank'); }), current.id); resolve(); })}
            />
          </motion.div>
        </AnimatePresence>
        <div className="card-surface flex flex-col gap-3 p-4">
          <Textarea rows={2} placeholder="Note to the teacher (used for request changes / reject)…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={pending} onClick={() => run(() => requestChanges(current.id, note || 'Please revise.'), current.id)}>Request changes (C)</Button>
            <Button variant="outline" className="text-rejected-foreground" disabled={pending} onClick={() => run(() => rejectItem(current.id, note || 'Rejected.'), current.id)}>Reject (R)</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
