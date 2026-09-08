'use client';

import { useTransition } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { LeadershipSummary } from '@/lib/leadership';
import { exportLeadershipPdf } from './actions';

const MAROON = '#931b20';
const NAVY = '#133363';
const GREY = '#9aa3b2';

export function ExportButton({ windowDays }: { windowDays: number }) {
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} onClick={() => start(async () => { try { window.open(await exportLeadershipPdf(windowDays), '_blank', 'noopener'); } catch (e) { toast.error((e as Error).message); } })}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} Export PDF
    </Button>
  );
}

export function LeadershipCharts({ s }: { s: LeadershipSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="card-surface p-5">
        <h3 className="mb-1 text-sm font-medium">Generations vs approvals, by week</h3>
        <p className="mb-3 text-xs text-muted-foreground">Every generation is a draft; only approvals reach anyone.</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={s.byWeek} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(w: string) => w.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Line type="linear" dataKey="generations" stroke={GREY} strokeWidth={2} dot={false} name="Generated" />
              <Line type="linear" dataKey="approvals" stroke={MAROON} strokeWidth={2.5} dot={false} name="Approved" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="card-surface p-5">
        <h3 className="mb-1 text-sm font-medium">How much teachers changed before approving</h3>
        <p className="mb-3 text-xs text-muted-foreground">Edit distance between the generated and final versions. Zero means approved as generated.</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.editBuckets} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Approvals">
                {s.editBuckets.map((_, i) => <Cell key={i} fill={i === 0 ? NAVY : MAROON} fillOpacity={1 - i * 0.18} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="card-surface p-5">
        <h3 className="mb-3 text-sm font-medium">Generations by module</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.byModule} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="module" tick={{ fontSize: 11 }} width={70} />
              <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Bar dataKey="generations" fill={NAVY} radius={[0, 6, 6, 0]} name="Generated" />
              <Bar dataKey="valid" fill={MAROON} radius={[0, 6, 6, 0]} name="Schema-valid" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="card-surface p-5">
        <h3 className="mb-3 text-sm font-medium">Providers used</h3>
        <ul className="flex flex-col gap-2 text-sm">
          {s.byProvider.map((p) => (
            <li key={p.provider} className="flex items-center gap-3">
              <span className="w-20 capitalize">{p.provider}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((p.count / Math.max(1, s.generations)) * 100)}%` }} /></span>
              <span className="tabular w-12 text-right text-muted-foreground">{p.count}</span>
            </li>
          ))}
          {s.byProvider.length === 0 && <li className="text-muted-foreground">No generations in this window.</li>}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Local dev runs on Ollama; production prefers Gemini Flash, then Groq, then Ollama. No prompt text is stored — only its hash.</p>
      </section>
    </div>
  );
}
