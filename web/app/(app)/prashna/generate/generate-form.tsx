'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Shimmer } from '@/components/motion/primitives';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { generateItems } from '../actions';
import { BLOOMS, ITEM_TYPES, label } from '../nav';

interface Outcome { id: string; ref_code: string; statement: string; frameworks: { code: string } | null }

export function GenerateForm({ frameworks, subjects, selection, outcomes }: { frameworks: { id: string; code: string; name: string }[]; subjects: { id: string; name: string }[]; selection: { framework: string; subject: string; grade: string }; outcomes: Outcome[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [itemType, setItemType] = useState('case_based');
  const [count, setCount] = useState(5);
  const [bloom, setBloom] = useState('apply');
  const [chapter, setChapter] = useState('');
  const [result, setResult] = useState<{ count: number } | null>(null);

  const nav = (patch: Partial<typeof selection>) => {
    const s = { ...selection, ...patch };
    router.replace(`/prashna/generate?framework=${s.framework}&subject=${s.subject}&grade=${s.grade}`);
    setSelected([]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="card-surface p-5">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5"><Label>Framework</Label><select className="h-9 rounded-lg border bg-card px-2 text-sm" value={selection.framework} onChange={(e) => nav({ framework: e.target.value })}>{frameworks.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}</select></div>
          <div className="flex flex-col gap-1.5"><Label>Subject</Label><select className="h-9 rounded-lg border bg-card px-2 text-sm" value={selection.subject} onChange={(e) => nav({ subject: e.target.value })}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="flex flex-col gap-1.5"><Label>Grade</Label><select className="h-9 rounded-lg border bg-card px-2 text-sm" value={selection.grade} onChange={(e) => nav({ grade: e.target.value })}>{['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((g) => <option key={g} value={g}>Grade {g}</option>)}</select></div>
        </div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Learning outcomes ({selected.length} selected)</p>
        <ul className="flex max-h-[26rem] flex-col gap-1 overflow-y-auto">
          {outcomes.map((o) => (
            <li key={o.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-accent">
                <input type="checkbox" className="mt-1 accent-primary" checked={selected.includes(o.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))} />
                <span className="text-sm">
                  <OutcomeChip size="sm" outcome={{ frameworkCode: o.frameworks?.code ?? '', refCode: o.ref_code, statement: o.statement }} /> <span className="ml-1">{o.statement}</span>
                </span>
              </label>
            </li>
          ))}
          {outcomes.length === 0 && <li className="p-4 text-sm text-muted-foreground">No outcomes for this framework/subject/grade yet — import them in SETU.</li>}
        </ul>
      </div>

      <form
        className="card-surface flex flex-col gap-4 self-start p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!selected.length) { toast.error('Pick at least one outcome'); return; }
          setResult(null);
          start(async () => {
            try {
              const r = await generateItems({ subjectId: selection.subject, grade: selection.grade, frameworkId: selection.framework, outcomeIds: selected, itemType, count, bloom, chapterText: chapter });
              setResult(r);
              toast.success(`${r.count} draft items generated`);
            } catch (err) {
              toast.error((err as Error).message);
            }
          });
        }}
      >
        <div className="flex flex-col gap-1.5"><Label>Item type</Label><select className="h-9 rounded-lg border bg-card px-2 text-sm capitalize" value={itemType} onChange={(e) => setItemType(e.target.value)}>{ITEM_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5"><Label htmlFor="count">Count</Label><Input id="count" type="number" min={1} max={30} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
          <div className="flex flex-col gap-1.5"><Label>Bloom</Label><select className="h-9 rounded-lg border bg-card px-2 text-sm capitalize" value={bloom} onChange={(e) => setBloom(e.target.value)}>{BLOOMS.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chapter">Chapter text (optional)</Label>
          <Textarea id="chapter" rows={5} placeholder="Paste chapter text or upload a .txt file to ground the items." value={chapter} onChange={(e) => setChapter(e.target.value)} />
          <input type="file" accept=".txt,.md" className="text-xs text-muted-foreground" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setChapter((await f.text()).slice(0, 8000)); }} />
        </div>
        <Button type="submit" disabled={pending} className="shadow-glow">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {pending ? 'Generating & validating…' : `Generate ${count} ${label(itemType)} items`}
        </Button>
        {pending && (
          <div className="flex flex-col gap-2" aria-live="polite">
            <p className="text-xs text-muted-foreground">Redacting → generating in batches of 5 → validating against the {label(itemType)} schema…</p>
            <Shimmer className="h-3 w-full" /><Shimmer className="h-3 w-4/5" /><Shimmer className="h-3 w-3/5" />
          </div>
        )}
        {result && (
          <p className="rounded-lg bg-approved px-3 py-2 text-sm text-approved-foreground">
            {result.count} items saved as drafts. <Link href="/prashna/bank?status=draft" className="underline">Open my drafts</Link>
          </p>
        )}
        <p className="text-xs text-muted-foreground">No student data enters this prompt. Every item is linked to the selected outcomes; the database refuses unlinked items.</p>
      </form>
    </div>
  );
}
