'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CloudOff, Send } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { addObservation } from '../actions';
import { CONTEXTS, DOMAIN_LABEL, DOMAINS } from '../nav';

const QUEUE_KEY = 'acharya.darpan.queue';
interface Pending { studentId: string; domain: string | null; context: string | null; note: string; outcomeId: string | null; observedOn: string }

function readQueue(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function writeQueue(q: Pending[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {}
}

export function QuickCapture({ students, outcomes, recent }: { students: { id: string; full_name: string }[]; outcomes: { id: string; ref_code: string }[]; recent: { id: string; note: string; domain: string | null; context: string | null; observed_on: string; students: { full_name: string } | null }[] }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [pending, start] = useTransition();
  const [studentId, setStudentId] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);

  const flush = async () => {
    const q = readQueue();
    if (!q.length) return;
    let ok = 0;
    for (const p of q) {
      try {
        await addObservation(p);
        ok++;
      } catch {
        break;
      }
    }
    writeQueue(q.slice(ok));
    setQueued(q.length - ok);
    if (ok) {
      toast.success(`${ok} queued observation${ok === 1 ? '' : 's'} synced`);
      router.refresh();
    }
  };

  useEffect(() => {
    setOnline(navigator.onLine);
    setQueued(readQueue().length);
    const on = () => { setOnline(true); void flush(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if (navigator.onLine) void flush();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!studentId) return toast.error('Pick a child');
    if (note.trim().length < 3) return toast.error('Write what you noticed');
    const p: Pending = { studentId, domain, context, note: note.trim(), outcomeId, observedOn: new Date().toISOString().slice(0, 10) };
    const reset = () => { setNote(''); setOutcomeId(null); };
    if (!online) {
      writeQueue([...readQueue(), p]);
      setQueued((n) => n + 1);
      toast.success('Saved offline — will sync when you are back online');
      reset();
      return;
    }
    start(async () => {
      try {
        await addObservation(p);
        toast.success('Observation saved');
        reset();
        router.refresh();
      } catch (e) {
        writeQueue([...readQueue(), p]);
        setQueued((n) => n + 1);
        toast.error(`${(e as Error).message} — kept in the offline queue`);
      }
    });
  };

  const chip = (active: boolean) => cn('min-h-11 rounded-full border px-3 text-sm transition-colors', active ? 'border-primary bg-primary-soft text-primary' : 'bg-card hover:bg-accent');

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="card-surface flex flex-col gap-4 p-4 sm:p-5">
        {(!online || queued > 0) && (
          <p className="inline-flex items-center gap-2 rounded-lg bg-pending px-3 py-2 text-xs text-pending-foreground"><CloudOff className="size-4" /> {online ? `${queued} queued — syncing` : `Offline · ${queued} queued`}</p>
        )}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Child</p>
          <div className="flex flex-wrap gap-2">
            {students.map((s) => <button key={s.id} type="button" className={chip(studentId === s.id)} onClick={() => setStudentId(s.id)}>{s.full_name}</button>)}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Domain (optional)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DOMAINS.map((d) => <button key={d} type="button" className={chip(domain === d)} onClick={() => setDomain(domain === d ? null : d)}>{DOMAIN_LABEL[d].en}</button>)}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Context (optional)</p>
          <div className="flex flex-wrap gap-2">
            {CONTEXTS.map((c) => <button key={c} type="button" className={chip(context === c)} onClick={() => setContext(context === c ? null : c)}>{c}</button>)}
          </div>
        </div>
        <Textarea rows={3} placeholder="What did you notice? One specific thing." value={note} onChange={(e) => setNote(e.target.value)} className="min-h-24 text-base" />
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-11 rounded-lg border bg-card px-2 text-sm" value={outcomeId ?? ''} onChange={(e) => setOutcomeId(e.target.value || null)} aria-label="Outcome tag">
            <option value="">Outcome tag (optional)</option>
            {outcomes.map((o) => <option key={o.id} value={o.id}>{o.ref_code}</option>)}
          </select>
          <motion.div className="ml-auto" whileTap={reduced ? undefined : { scale: 0.97 }}>
            <Button size="lg" className="h-11 min-w-36 shadow-glow" disabled={pending} onClick={submit}><Send className="size-4" /> Save</Button>
          </motion.div>
        </div>
      </div>
      <aside className="card-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Recent</p>
        <ul className="flex flex-col gap-3">
          {recent.map((r) => (
            <li key={r.id} className="text-sm">
              <p className="font-medium">{r.students?.full_name}</p>
              <p>{r.note}</p>
              <p className="text-xs text-muted-foreground">{r.observed_on} · {r.domain ? DOMAIN_LABEL[r.domain]?.en : '—'} · {r.context ?? '—'}</p>
            </li>
          ))}
          {recent.length === 0 && <li className="text-sm text-muted-foreground">Nothing recorded yet.</li>}
        </ul>
      </aside>
    </div>
  );
}
