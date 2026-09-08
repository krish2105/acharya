'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { confirmCrossAlignment } from '../../actions';

interface Cand { id: string; ref_code: string; statement: string; grade: string; frameworks: { code: string } | null }
interface Sim { outcome_id: string; ref_code: string; statement: string; framework_code: string; grade: string; similarity: number }
interface Conf { outcome_a: string; outcome_b: string; relation: string; similarity: number | null; a: { ref_code: string; statement: string; frameworks: { code: string } | null }; b: { ref_code: string; statement: string; frameworks: { code: string } | null } }

const RELATIONS = ['equivalent', 'partial', 'prerequisite', 'extends'];

export function CrossAlignmentView({ q, candidates, source, similar, confirmed, canConfirm }: { q: string; candidates: Cand[]; source: Cand | null; similar: Sim[]; confirmed: Conf[]; canConfirm: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [relations, setRelations] = useState<Record<string, string>>({});

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <aside className="card-surface p-4">
        <Input
          defaultValue={q}
          placeholder="Find an outcome…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') router.push(`/setu/alignment/cross?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
          }}
        />
        <ul className="mt-3 flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
          {candidates.map((c) => (
            <li key={c.id}>
              <Link
                href={`/setu/alignment/cross?outcome=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                className={`block rounded-lg px-2 py-2 text-sm hover:bg-accent ${source?.id === c.id ? 'bg-primary-soft' : ''}`}
              >
                <span className="font-mono text-xs text-primary">{c.frameworks?.code} / {c.ref_code}</span>
                <span className="block truncate text-muted-foreground">{c.statement}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex flex-col gap-4">
        {!source ? (
          <div className="card-surface p-10 text-center text-sm text-muted-foreground">Choose an outcome on the left.</div>
        ) : (
          <>
            <div className="card-surface p-5">
              <OutcomeChip outcome={{ frameworkCode: source.frameworks?.code ?? '', refCode: source.ref_code, statement: source.statement }} />
              <p className="mt-2 text-lg">{source.statement}</p>
              <p className="mt-1 text-xs text-muted-foreground">Grade {source.grade}</p>
            </div>

            <div className="card-surface overflow-hidden">
              <h3 className="border-b px-5 py-3 text-sm font-medium text-muted-foreground">Nearest outcomes in other frameworks</h3>
              <ul>
                {similar.length === 0 && <li className="px-5 py-6 text-sm text-muted-foreground">No embedded outcomes in other frameworks yet — run the alignment engine.</li>}
                {similar.map((s) => {
                  const done = confirmed.find((c) => (c.outcome_a === source.id && c.outcome_b === s.outcome_id) || (c.outcome_b === source.id && c.outcome_a === s.outcome_id));
                  return (
                    <li key={s.outcome_id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b px-5 py-3 last:border-b-0">
                      <div className="min-w-0">
                        <OutcomeChip size="sm" outcome={{ frameworkCode: s.framework_code, refCode: s.ref_code, statement: s.statement }} />
                        <p className="mt-1 text-sm">{s.statement}</p>
                        <p className="text-xs text-muted-foreground">Grade {s.grade} · similarity {Math.round(Number(s.similarity) * 100)}%</p>
                      </div>
                      {done ? (
                        <span className="rounded-full bg-approved px-2.5 py-1 text-xs font-medium capitalize text-approved-foreground">{done.relation}</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            className="h-9 rounded-lg border bg-card px-2 text-sm"
                            value={relations[s.outcome_id] ?? 'equivalent'}
                            onChange={(e) => setRelations((r) => ({ ...r, [s.outcome_id]: e.target.value }))}
                            aria-label="Relation"
                          >
                            {RELATIONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            disabled={pending || !canConfirm}
                            onClick={() =>
                              start(async () => {
                                try {
                                  await confirmCrossAlignment(source.id, s.outcome_id, relations[s.outcome_id] ?? 'equivalent', Number(s.similarity));
                                  toast.success('Alignment confirmed');
                                } catch (e) {
                                  toast.error((e as Error).message);
                                }
                              })
                            }
                          >
                            Confirm
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {confirmed.length > 0 && (
              <div className="card-surface overflow-hidden">
                <h3 className="border-b px-5 py-3 text-sm font-medium text-muted-foreground">Confirmed equivalents</h3>
                <ul>
                  {confirmed.map((c) => {
                    const other = c.outcome_a === source.id ? c.b : c.a;
                    return (
                      <li key={`${c.outcome_a}-${c.outcome_b}`} className="flex items-center gap-3 border-b px-5 py-3 text-sm last:border-b-0">
                        <OutcomeChip size="sm" outcome={{ frameworkCode: other.frameworks?.code ?? '', refCode: other.ref_code, statement: other.statement }} />
                        <span className="flex-1 truncate">{other.statement}</span>
                        <span className="rounded-full bg-approved px-2 py-0.5 text-[11px] font-medium capitalize text-approved-foreground">{c.relation}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
