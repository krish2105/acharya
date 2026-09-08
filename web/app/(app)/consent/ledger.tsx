'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, FileJson, Search, UserX, X } from 'lucide-react';
import { toast } from 'sonner';
import { StatusPill } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createErasureRequest, decideErasure, executeErasureRequest, exportStudentData } from './actions';

export interface ConsentRow { student_id: string; purpose: string; granted: boolean; withdrawn_at: string | null; consent_version: string; via: string | null; students: { full_name: string; admission_no: string; sections: { grade: string; section: string } | null } | null }
export interface ErasureRow { id: string; student_id: string; reason: string | null; status: string; requested_at: string; decision_note: string | null; executed_at: string | null; students: { full_name: string; admission_no: string } | null }

const PURPOSES = ['data_processing', 'parent_input', 'report_release', 'media_use'];

export function ConsentLedger({ consents, erasures }: { consents: ConsentRow[]; erasures: ErasureRow[] }) {
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();
  const students = useMemo(() => {
    const map = new Map<string, { id: string; name: string; adm: string; klass: string; purposes: Record<string, ConsentRow | undefined> }>();
    for (const c of consents) {
      const s = map.get(c.student_id) ?? { id: c.student_id, name: c.students?.full_name ?? '', adm: c.students?.admission_no ?? '', klass: c.students?.sections ? `${c.students.sections.grade}${c.students.sections.section}` : '', purposes: {} };
      const prev = s.purposes[c.purpose];
      if (!prev || (c.granted && !c.withdrawn_at)) s.purposes[c.purpose] = c;
      map.set(c.student_id, s);
    }
    return [...map.values()].sort((a, b) => a.adm.localeCompare(b.adm));
  }, [consents]);
  const shown = students.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.adm.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  const run = (fn: () => Promise<unknown>, ok: string) => start(async () => { try { await fn(); toast.success(ok); } catch (e) { toast.error((e as Error).message); } });

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-medium">Consent ledger <span className="text-sm text-muted-foreground">· {students.length} students</span></h3>
          <label className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or admission no." className="h-9 w-64 pl-8" aria-label="Search students" /></label>
        </div>
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Class</th>{PURPOSES.map((p) => <th key={p} className="px-3 py-2 capitalize">{p.replace('_', ' ')}</th>)}<th className="px-3 py-2">Rights</th></tr></thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2"><span className="font-medium">{s.name}</span><span className="ml-1 font-mono text-[11px] text-muted-foreground">{s.adm}</span></td>
                  <td className="px-3 py-2">{s.klass}</td>
                  {PURPOSES.map((p) => { const c = s.purposes[p]; const on = !!c && c.granted && !c.withdrawn_at; return <td key={p} className="px-3 py-2"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${on ? 'bg-approved text-approved-foreground' : 'bg-muted text-muted-foreground'}`}>{on ? <Check className="size-3" /> : <X className="size-3" />}{c ? `${c.consent_version}${c.via ? ` · ${c.via}` : ''}` : 'none'}</span></td>; })}
                  <td className="px-3 py-2"><div className="flex gap-1">
                    <Button size="sm" variant="ghost" disabled={pending} title="Export all data held (JSON)" onClick={() => run(async () => { const u = await exportStudentData(s.id); window.open(u, '_blank', 'noopener'); }, 'Export ready')}><FileJson className="size-4" /></Button>
                    <Button size="sm" variant="ghost" disabled={pending} title="Raise an erasure request" onClick={() => { const reason = window.prompt('Reason for erasure (recorded in the ledger):'); if (reason !== null) run(() => createErasureRequest(s.id, reason), 'Erasure request raised'); }}><UserX className="size-4" /></Button>
                  </div></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No students match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg font-medium">Erasure requests <span className="text-sm text-muted-foreground">· {erasures.length}</span></h3>
        {erasures.length === 0 ? <p className="card-surface p-6 text-sm text-muted-foreground">No erasure requests. Parents can raise one from the portal; leadership approves, then executes. Aggregate item statistics survive; every personal record is deleted or anonymised.</p> : (
          <ul className="flex flex-col gap-2">
            {erasures.map((r) => (
              <li key={r.id} className="card-surface flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{r.students?.full_name ?? 'Student'} <span className="font-mono text-[11px] text-muted-foreground">{r.students?.admission_no}</span> <StatusPill status={r.status === 'executed' ? 'approved' : r.status} label={r.status} /></p>
                  <p className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleDateString('en-IN')} · {r.reason ?? 'no reason given'}{r.decision_note ? ` · ${r.decision_note}` : ''}{r.executed_at ? ` · executed ${new Date(r.executed_at).toLocaleDateString('en-IN')}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  {r.status === 'pending' && <>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideErasure(r.id, 'rejected', 'Rejected by leadership'), 'Rejected')}>Reject</Button>
                    <Button size="sm" disabled={pending} onClick={() => run(() => decideErasure(r.id, 'approved', 'Approved by leadership'), 'Approved — ready to execute')}>Approve</Button>
                  </>}
                  {r.status === 'approved' && <Button size="sm" variant="destructive" disabled={pending} onClick={() => { if (window.confirm('Execute erasure? Personal records are deleted or anonymised. This cannot be undone.')) run(() => executeErasureRequest(r.id), 'Erasure executed'); }}>Execute erasure</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
