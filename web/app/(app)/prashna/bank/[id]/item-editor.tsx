'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import { History, Plus, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApprovalCard } from '@/components/shared/approval-card';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { StatusPill } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { approveItem, createItem, saveItem, submitForReview } from '../../actions';
import { BLOOMS, DIFFICULTIES, ITEM_TYPES, label } from '../../nav';

interface Outcome { id: string; ref_code: string; statement: string; grade?: string; frameworks: { code: string } | null }
interface Item {
  id: string; stem: string; stimulus: string | null; options: { label: string; text: string }[] | null; parts: { text: string; marks: number }[] | null;
  answer_key: Record<string, unknown>; marking_scheme: string | null; marks: number; cognitive_level: string; difficulty_intended: string | null;
  item_type: string; status: string; grade: string; subject_id: string; framework_id: string; review_note: string | null; origin: string;
  item_outcomes: { learning_outcomes: Outcome | null }[]; approvals: { edit_distance: number | null }[] | null;
}

const textOf = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v ?? ''));

export function ItemEditor({ item, versions, candidates, frameworks, subjects, canApprove, isOwner, q }: {
  item: Item | null; versions: { version: number; body: Record<string, unknown>; edited_at: string }[]; candidates: Outcome[];
  frameworks: { id: string; code: string }[]; subjects: { id: string; name: string }[]; canApprove: boolean; isOwner: boolean; q: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [outcomes, setOutcomes] = useState<Outcome[]>(item?.item_outcomes.map((io) => io.learning_outcomes!).filter(Boolean) ?? []);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({
    item_type: item?.item_type ?? 'mcq', marks: item?.marks ?? 1, cognitive_level: item?.cognitive_level ?? 'apply',
    difficulty_intended: item?.difficulty_intended ?? 'medium', grade: item?.grade ?? '10', subject_id: item?.subject_id ?? subjects[0]?.id ?? '',
    framework_id: item?.framework_id ?? frameworks[0]?.id ?? '', stimulus: item?.stimulus ?? '', marking_scheme: item?.marking_scheme ?? '',
    answer_key: JSON.stringify(item?.answer_key ?? { correct: 'A' }, null, 2), options: item?.options ?? [{ label: 'A', text: '' }, { label: 'B', text: '' }, { label: 'C', text: '' }, { label: 'D', text: '' }],
  });
  const editor = useEditor({
    extensions: [StarterKit],
    content: item?.stem ? `<p>${item.stem.replace(/\n/g, '</p><p>')}</p>` : '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'prose prose-sm max-w-none min-h-32 rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40' } },
  });
  const locked = item ? item.status === 'approved' || (!isOwner && !canApprove) : false;
  const isMcq = form.item_type === 'mcq' || form.item_type === 'assertion_reason';

  const first = versions[0]?.body;
  const last = versions[versions.length - 1]?.body;
  const changed = useMemo(() => JSON.stringify(first) !== JSON.stringify(last), [first, last]);

  const persist = () =>
    start(async () => {
      try {
        let answerKey: unknown;
        try {
          answerKey = JSON.parse(form.answer_key);
        } catch {
          toast.error('Answer key must be valid JSON');
          return;
        }
        const stem = editor?.getText().trim() ?? '';
        if (stem.length < 10) {
          toast.error('Stem is too short');
          return;
        }
        if (outcomes.length === 0) {
          toast.error('Link at least one learning outcome — the database will refuse otherwise.');
          return;
        }
        const patch = { stem, stimulus: form.stimulus || null, options: isMcq ? form.options : null, answer_key: answerKey, marking_scheme: form.marking_scheme, marks: Number(form.marks), cognitive_level: form.cognitive_level, difficulty_intended: form.difficulty_intended };
        if (item) {
          const v = await saveItem(item.id, patch, outcomes.map((o) => o.id));
          toast.success(`Saved as version ${v}`);
          router.refresh();
        } else {
          const id = await createItem({ ...patch, item_type: form.item_type, grade: form.grade, subject_id: form.subject_id, framework_id: form.framework_id }, outcomes.map((o) => o.id));
          toast.success('Item created');
          router.push(`/prashna/bank/${id}`);
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        {item && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusPill status={item.status} />
            <span>{label(item.origin)}</span>
            {item.review_note && <span className="rounded-full bg-pending px-2 py-0.5 text-pending-foreground">Review note: {item.review_note}</span>}
            {item.approvals?.[0] && <span>edit distance {item.approvals[0].edit_distance}</span>}
          </div>
        )}

        <div className="card-surface flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <Label>Stem</Label>
            {editor ? <EditorContent editor={editor} /> : <div className="h-32 rounded-lg border bg-muted" />}
          </div>
          {(form.item_type === 'case_based' || form.item_type === 'source_based' || form.item_type === 'competency_cluster') && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stimulus">Stimulus (case / source)</Label>
              <Textarea id="stimulus" rows={4} value={form.stimulus} onChange={(e) => setForm({ ...form, stimulus: e.target.value })} disabled={locked} />
            </div>
          )}
          {isMcq && (
            <div className="grid gap-2 sm:grid-cols-2">
              {form.options.map((o, i) => (
                <div key={o.label} className="flex items-center gap-2">
                  <span className="w-6 font-mono text-xs text-muted-foreground">{o.label}</span>
                  <Input value={o.text} disabled={locked} onChange={(e) => setForm({ ...form, options: form.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="answer_key">Answer key (JSON)</Label>
              <Textarea id="answer_key" rows={4} className="font-mono text-xs" value={form.answer_key} onChange={(e) => setForm({ ...form, answer_key: e.target.value })} disabled={locked} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheme">Marking scheme</Label>
              <Textarea id="scheme" rows={4} value={form.marking_scheme} onChange={(e) => setForm({ ...form, marking_scheme: e.target.value })} disabled={locked} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { k: 'item_type', l: 'Type', opts: ITEM_TYPES, disabled: !!item },
              { k: 'cognitive_level', l: 'Bloom', opts: BLOOMS },
              { k: 'difficulty_intended', l: 'Difficulty', opts: DIFFICULTIES },
            ].map((f) => (
              <div key={f.k} className="flex flex-col gap-1.5">
                <Label>{f.l}</Label>
                <select className="h-9 rounded-lg border bg-card px-2 text-sm capitalize" value={String(form[f.k as keyof typeof form])} disabled={locked || f.disabled} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}>
                  {f.opts.map((o) => <option key={o} value={o}>{label(o)}</option>)}
                </select>
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="marks">Marks</Label>
              <Input id="marks" type="number" min={1} step={0.5} value={form.marks} disabled={locked} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} />
            </div>
            {!item && (
              <>
                <div className="flex flex-col gap-1.5"><Label>Framework</Label><select className="h-9 rounded-lg border bg-card px-2 text-sm" value={form.framework_id} onChange={(e) => setForm({ ...form, framework_id: e.target.value })}>{frameworks.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}</select></div>
                <div className="flex flex-col gap-1.5"><Label>Subject</Label><select className="h-9 rounded-lg border bg-card px-2 text-sm" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="grade">Grade</Label><Input id="grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></div>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <div className="flex gap-2">
              {item && versions.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setShowHistory((s) => !s)}><History className="size-4" /> {versions.length} versions</Button>
              )}
            </div>
            <div className="flex gap-2">
              {!locked && <Button variant="outline" disabled={pending} onClick={persist}>{item ? 'Save version' : 'Create draft'}</Button>}
              {item && item.status === 'draft' && isOwner && (
                <Button disabled={pending} onClick={() => start(async () => { try { await submitForReview(item.id); toast.success('Sent to HOD'); router.refresh(); } catch (e) { toast.error((e as Error).message); } })}>
                  <Send className="size-4" /> Submit for review
                </Button>
              )}
              {item && item.status === 'pending_review' && canApprove && (
                <Button disabled={pending} onClick={() => start(async () => { try { await approveItem(item.id); toast.success('Approved into the shared bank'); router.refresh(); } catch (e) { toast.error((e as Error).message); } })}>
                  Approve
                </Button>
              )}
            </div>
          </div>
        </div>

        {item && showHistory && first && last && (
          <ApprovalCard
            title="What changed since the first draft"
            outcome={{ frameworkCode: outcomes[0]?.frameworks?.code ?? '', refCode: outcomes[0]?.ref_code ?? '', statement: outcomes[0]?.statement ?? '' }}
            generatedText={textOf(first.stem)}
            finalText={textOf(last.stem)}
            approved={item.status === 'approved'}
            meta={changed ? `v1 → v${versions.length}` : 'No changes to the stem'}
          />
        )}
      </div>

      <aside className="flex flex-col gap-3">
        <div className="card-surface p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Linked outcomes (required)</p>
          <div className="flex flex-col gap-2">
            {outcomes.map((o) => (
              <div key={o.id} className="flex items-start gap-2">
                <OutcomeChip size="sm" outcome={{ frameworkCode: o.frameworks?.code ?? '', refCode: o.ref_code, statement: o.statement }} />
                {!locked && <button type="button" aria-label="Unlink" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setOutcomes(outcomes.filter((x) => x.id !== o.id))}><X className="size-4" /></button>}
              </div>
            ))}
            {outcomes.length === 0 && <p className="text-xs text-rejected-foreground">At least one outcome is required.</p>}
          </div>
        </div>
        {!locked && (
          <div className="card-surface p-4">
            <Input defaultValue={q} placeholder="Find an outcome…" className="mb-2" onKeyDown={(e) => e.key === 'Enter' && router.replace(`?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`)} />
            <ul className="flex flex-col gap-1">
              {candidates.filter((c) => !outcomes.some((o) => o.id === c.id)).map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-xs">
                  <button type="button" aria-label="Link" className="mt-0.5 text-primary" onClick={() => setOutcomes([...outcomes, c])}><Plus className="size-4" /></button>
                  <span><span className="font-mono text-primary">{c.ref_code}</span> {c.statement}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
