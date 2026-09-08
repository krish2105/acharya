'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { Shimmer } from '@/components/motion/primitives';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { recordGenerated } from './actions';
import { KIND_LABEL, type Kind } from './nav';

interface Unit { id: string; title: string; grade: string; frameworks: { code: string } | null; subjects: { name: string } | null }
interface Outcome { id: string; ref_code: string; statement: string; grade: string; frameworks: { code: string } | null }
interface Section { id: string; grade: string; section: string }
interface Student { id: string; full_name: string; admission_no: string }

const STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'resolving_outcomes', label: 'Resolving outcomes' },
  { key: 'redacting', label: 'Redacting PII' },
  { key: 'generating', label: 'Generating' },
  { key: 'validating', label: 'Validating against schema' },
  { key: 'saving', label: 'Saving draft' },
  { key: 'done', label: 'Done' },
];

export function GenerateForm({ kind, units, outcomes, sections, students, q }: { kind: Kind; units: Unit[]; outcomes: Outcome[]; sections: Section[]; students: Student[]; q: string }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<'unit' | 'outcomes'>(kind === 'parent_message' || kind === 'rubric' || kind === 'worksheet' ? 'outcomes' : 'unit');
  const [unitId, setUnitId] = useState(units[0]?.id ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [studentId, setStudentId] = useState(students[0]?.id ?? '');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMessage = kind === 'parent_message';

  const run = async () => {
    setError(null);
    if (mode === 'unit' && !unitId) return toast.error('Pick a unit');
    if (mode === 'outcomes' && selected.length === 0) return toast.error('Pick at least one outcome');
    if (isMessage && !studentId) return toast.error('Pick a student');
    if (kind === 'rubric' && !notes.trim()) return toast.error('Describe the task for the rubric');
    setStage('queued');
    try {
      const res = await fetch('/api/saarthi/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, unit_id: mode === 'unit' ? unitId : null, outcome_ids: mode === 'outcomes' ? selected : null, section_id: sectionId || null, student_id: isMessage ? studentId : null, language, notes }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';
        for (const c of chunks) {
          const line = c.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const ev = JSON.parse(line.slice(6));
          if (ev.stage) setStage(ev.stage);
          if (ev.error) throw new Error(ev.error === 'guardrail' ? `Rejected by post-validation: ${ev.violations.join(', ')}` : ev.error);
          if (ev.result) {
            setStage('done');
            await recordGenerated(ev.result.artifact_id, kind);
            toast.success(`${KIND_LABEL[kind]} drafted (${ev.result.redaction_count} PII spans redacted)`);
            router.push(`/saarthi/history/${ev.result.artifact_id}`);
            return;
          }
        }
      }
      throw new Error('stream ended without a result');
    } catch (e) {
      setError((e as Error).message);
      setStage(null);
    }
  };

  const stageIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="card-surface flex flex-col gap-4 p-5">
        {!isMessage && (
          <div className="flex gap-2">
            {(['unit', 'outcomes'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full border px-3 py-1 text-sm ${mode === m ? 'border-primary bg-primary-soft text-primary' : 'text-muted-foreground'}`}>
                Start from {m === 'unit' ? 'a unit' : 'outcomes'}
              </button>
            ))}
          </div>
        )}
        {mode === 'unit' && !isMessage ? (
          <div className="flex flex-col gap-1.5">
            <Label>Unit</Label>
            <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {units.map((u) => <option key={u.id} value={u.id}>{u.frameworks?.code} · Grade {u.grade} · {u.title} ({u.subjects?.name})</option>)}
            </select>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Learning outcomes ({selected.length} selected)</Label>
              <Input defaultValue={q} placeholder="Search…" className="h-8 w-56" onKeyDown={(e) => e.key === 'Enter' && router.replace(`?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`)} />
            </div>
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {outcomes.map((o) => (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-accent">
                    <input type="checkbox" className="mt-1 accent-primary" checked={selected.includes(o.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))} />
                    <span><OutcomeChip size="sm" outcome={{ frameworkCode: o.frameworks?.code ?? '', refCode: o.ref_code, statement: o.statement }} /> <span className="ml-1">{o.statement}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Section</Label>
            <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">—</option>
              {sections.map((s) => <option key={s.id} value={s.id}>Grade {s.grade}{s.section}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Output language</Label>
            <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'hi')}>
              <option value="en">English</option><option value="hi">हिन्दी</option>
            </select>
          </div>
        </div>
        {isMessage && (
          <div className="flex flex-col gap-1.5">
            <Label>Student</Label>
            <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.admission_no}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">The child&apos;s and guardian&apos;s names, admission number, phone and DOB are replaced with placeholders before the prompt exists, and restored in the draft afterwards.</p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">{kind === 'rubric' ? 'Task description' : isMessage ? 'Your notes about the child' : kind === 'revision_sheet' ? 'Exam context' : 'Notes for the model (optional)'}</Label>
          <Textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isMessage ? 'e.g. Read three pages aloud with confidence; struggling with carrying in addition — try five minutes at home.' : ''} />
        </div>
      </div>

      <div className="card-surface flex flex-col gap-4 self-start p-5">
        <h3 className="font-display text-lg font-medium">{KIND_LABEL[kind]}</h3>
        <Button className="shadow-glow" disabled={stage !== null} onClick={run}>
          {stage ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {stage ? 'Working…' : 'Generate draft'}
        </Button>
        <ol className="flex flex-col gap-2" aria-live="polite">
          {STAGES.map((s, i) => {
            const done = stageIdx > i || stage === 'done';
            const active = stageIdx === i && stage !== 'done';
            return (
              <li key={s.key} className={`flex items-center gap-2 text-sm ${done ? 'text-approved-foreground' : active ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                <motion.span layout className={`grid size-5 place-items-center rounded-full border text-[10px] ${done ? 'border-approved-foreground bg-approved' : active ? 'border-primary' : ''}`} animate={active && !reduced ? { scale: [1, 1.15, 1] } : {}} transition={{ repeat: Infinity, duration: 1.2 }}>
                  {done ? <Check className="size-3" /> : i + 1}
                </motion.span>
                {s.label}
              </li>
            );
          })}
        </ol>
        {stage === 'generating' && <div className="flex flex-col gap-2"><Shimmer /><Shimmer className="h-3 w-4/5" /><Shimmer className="h-3 w-3/5" /></div>}
        {error && <p role="alert" className="rounded-lg bg-rejected px-3 py-2 text-sm text-rejected-foreground">{error}</p>}
        <p className="text-xs text-muted-foreground">Drafts are private until you approve them. Approved artifacts can be shared with your department.</p>
      </div>
    </div>
  );
}
