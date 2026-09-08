'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

const cls = 'h-9 rounded-lg border bg-card px-2 text-sm';

export function BankFilters({ frameworks, subjects, types, blooms, difficulties }: { frameworks: { id: string; code: string }[]; subjects: { id: string; name: string }[]; types: string[]; blooms: string[]; difficulties: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.replace(`${pathname}?${n.toString()}`);
  };
  const Sel = ({ k, label, options }: { k: string; label: string; options: { v: string; l: string }[] }) => (
    <select className={cls} value={sp.get(k) ?? ''} onChange={(e) => set(k, e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.v} value={o.v}>{o.l}</option>
      ))}
    </select>
  );
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Input placeholder="Search stems…" defaultValue={sp.get('q') ?? ''} className="h-9 w-56" onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)} />
      <Input placeholder="Outcome code…" defaultValue={sp.get('outcome') ?? ''} className="h-9 w-40 font-mono text-xs" onKeyDown={(e) => e.key === 'Enter' && set('outcome', (e.target as HTMLInputElement).value)} />
      <Sel k="status" label="All states" options={['draft', 'pending_review', 'approved', 'retired'].map((s) => ({ v: s, l: s.replace('_', ' ') }))} />
      <Sel k="framework" label="All frameworks" options={frameworks.map((f) => ({ v: f.id, l: f.code }))} />
      <Sel k="subject" label="All subjects" options={subjects.map((s) => ({ v: s.id, l: s.name }))} />
      <Sel k="grade" label="All grades" options={['6', '7', '8', '9', '10', '11', '12'].map((g) => ({ v: g, l: `Grade ${g}` }))} />
      <Sel k="type" label="All types" options={types.map((t) => ({ v: t, l: t.replace(/_/g, ' ') }))} />
      <Sel k="bloom" label="All Bloom levels" options={blooms.map((b) => ({ v: b, l: b }))} />
      <Sel k="difficulty" label="Any difficulty" options={difficulties.map((d) => ({ v: d, l: d }))} />
    </div>
  );
}
