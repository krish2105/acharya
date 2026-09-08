'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveBlueprint } from '../actions';
import { ITEM_TYPES, label } from '../nav';

interface Section { label: string; title: string; item_types: string[]; marks_each: number; count: number }
interface Composition { competency_pct: number; objective_pct: number; long_answer_pct: number; bloom_mix: Record<string, number>; sections: Section[] }
interface Blueprint { id: string; label: string; grade: string; total_marks: number; duration_minutes: number | null; composition: Composition; framework_id: string; subject_id: string; frameworks: { code: string } | null; subjects: { name: string } | null }

const EMPTY: Composition = { competency_pct: 50, objective_pct: 20, long_answer_pct: 30, bloom_mix: { remember: 0.1, understand: 0.2, apply: 0.3, analyse: 0.25, evaluate: 0.1, create: 0.05 }, sections: [{ label: 'A', title: 'Objective', item_types: ['mcq'], marks_each: 1, count: 10 }] };

export function BlueprintBuilder({ blueprints, frameworks, subjects }: { blueprints: Blueprint[]; frameworks: { id: string; code: string }[]; subjects: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<Blueprint | null>(null);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<{ id?: string; label: string; grade: string; frameworkId: string; subjectId: string; durationMinutes: number; comp: Composition } | null>(null);

  const open = (b?: Blueprint) => {
    setEditing(b ?? null);
    setDraft(b
      ? { id: b.id, label: b.label, grade: b.grade, frameworkId: b.framework_id, subjectId: b.subject_id, durationMinutes: b.duration_minutes ?? 90, comp: structuredClone(b.composition) }
      : { label: '', grade: '10', frameworkId: frameworks[0]?.id ?? '', subjectId: subjects[0]?.id ?? '', durationMinutes: 90, comp: structuredClone(EMPTY) });
  };
  const total = (c: Composition) => c.sections.reduce((s, x) => s + x.marks_each * x.count, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex justify-end"><Button onClick={() => open()}><Plus className="size-4" /> New blueprint</Button></div>
        {blueprints.map((b) => (
          <article key={b.id} className="card-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-primary">{b.frameworks?.code} · Grade {b.grade} · {b.subjects?.name}</p>
                <h3 className="font-display text-lg font-medium">{b.label}</h3>
                <p className="text-xs text-muted-foreground tabular">{b.total_marks} marks · {b.duration_minutes} min · competency {b.composition.competency_pct}% · objective {b.composition.objective_pct}% · long answer {b.composition.long_answer_pct}%</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => open(b)}>Edit</Button>
            </div>
            <table className="mt-3 w-full text-xs">
              <thead className="text-muted-foreground"><tr><th className="text-left font-medium">Section</th><th className="text-left font-medium">Types</th><th className="text-right font-medium">Each</th><th className="text-right font-medium">Count</th><th className="text-right font-medium">Marks</th></tr></thead>
              <tbody>{b.composition.sections.map((s) => (
                <tr key={s.label} className="border-t"><td className="py-1">{s.label} · {s.title}</td><td className="capitalize">{s.item_types.map(label).join(', ')}</td><td className="text-right tabular">{s.marks_each}</td><td className="text-right tabular">{s.count}</td><td className="text-right tabular">{s.marks_each * s.count}</td></tr>
              ))}</tbody>
            </table>
          </article>
        ))}
      </div>

      {draft && (
        <form
          className="card-surface flex flex-col gap-4 self-start p-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              try {
                await saveBlueprint({ id: draft.id, frameworkId: draft.frameworkId, subjectId: draft.subjectId, grade: draft.grade, label: draft.label, totalMarks: total(draft.comp), durationMinutes: draft.durationMinutes, composition: draft.comp });
                toast.success('Blueprint saved');
                setDraft(null);
              } catch (err) {
                toast.error((err as Error).message);
              }
            });
          }}
        >
          <h3 className="font-display text-lg font-medium">{editing ? 'Edit blueprint' : 'New blueprint'}</h3>
          <div className="flex flex-col gap-1.5"><Label htmlFor="label">Label</Label><Input id="label" required value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></div>
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5"><Label>Framework</Label><select className="h-9 rounded-lg border bg-card px-2 text-sm" value={draft.frameworkId} onChange={(e) => setDraft({ ...draft, frameworkId: e.target.value })}>{frameworks.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}</select></div>
            <div className="flex flex-col gap-1.5"><Label>Subject</Label><select className="h-9 rounded-lg border bg-card px-2 text-sm" value={draft.subjectId} onChange={(e) => setDraft({ ...draft, subjectId: e.target.value })}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="flex flex-col gap-1.5"><Label>Grade</Label><Input value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label>Minutes</Label><Input type="number" value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(['competency_pct', 'objective_pct', 'long_answer_pct'] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1.5"><Label className="capitalize">{k.replace('_pct', '').replace('_', ' ')} %</Label><Input type="number" min={0} max={100} value={draft.comp[k]} onChange={(e) => setDraft({ ...draft, comp: { ...draft.comp, [k]: Number(e.target.value) } })} /></div>
            ))}
          </div>
          <div>
            <Label>Bloom mix (shares sum to 1)</Label>
            <div className="mt-1 grid grid-cols-6 gap-2">
              {Object.entries(draft.comp.bloom_mix).map(([b, v]) => (
                <div key={b} className="flex flex-col gap-1"><span className="text-[11px] capitalize text-muted-foreground">{b}</span><Input type="number" step={0.05} min={0} max={1} value={v} onChange={(e) => setDraft({ ...draft, comp: { ...draft.comp, bloom_mix: { ...draft.comp.bloom_mix, [b]: Number(e.target.value) } } })} /></div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between"><Label>Sections</Label><span className="text-xs text-muted-foreground tabular">Total {total(draft.comp)} marks</span></div>
            <div className="mt-2 flex flex-col gap-2">
              {draft.comp.sections.map((s, i) => (
                <div key={i} className="grid grid-cols-[3rem_1fr_1fr_4rem_4rem_2rem] items-center gap-2">
                  <Input value={s.label} aria-label="Label" onChange={(e) => setDraft({ ...draft, comp: { ...draft.comp, sections: draft.comp.sections.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } })} />
                  <Input value={s.title} aria-label="Title" onChange={(e) => setDraft({ ...draft, comp: { ...draft.comp, sections: draft.comp.sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) } })} />
                  <select multiple className="h-16 rounded-lg border bg-card px-1 text-xs capitalize" value={s.item_types} aria-label="Item types" onChange={(e) => setDraft({ ...draft, comp: { ...draft.comp, sections: draft.comp.sections.map((x, j) => (j === i ? { ...x, item_types: [...e.target.selectedOptions].map((o) => o.value) } : x)) } })}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
                  </select>
                  <Input type="number" step={0.5} min={0.5} value={s.marks_each} aria-label="Marks each" onChange={(e) => setDraft({ ...draft, comp: { ...draft.comp, sections: draft.comp.sections.map((x, j) => (j === i ? { ...x, marks_each: Number(e.target.value) } : x)) } })} />
                  <Input type="number" min={1} value={s.count} aria-label="Count" onChange={(e) => setDraft({ ...draft, comp: { ...draft.comp, sections: draft.comp.sections.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)) } })} />
                  <button type="button" aria-label="Remove section" className="text-muted-foreground hover:text-rejected-foreground" onClick={() => setDraft({ ...draft, comp: { ...draft.comp, sections: draft.comp.sections.filter((_, j) => j !== i) } })}><Trash2 className="size-4" /></button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, comp: { ...draft.comp, sections: [...draft.comp.sections, { label: String.fromCharCode(65 + draft.comp.sections.length), title: '', item_types: ['short_answer'], marks_each: 2, count: 5 }] } })}><Plus className="size-4" /> Add section</Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save blueprint'}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
