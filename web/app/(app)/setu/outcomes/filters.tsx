'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

const GRADES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export function OutcomeFilters({ frameworks, subjects }: { frameworks: { id: string; code: string }[]; subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('import');
    router.replace(`${pathname}?${next.toString()}`);
  };

  const select = 'h-9 rounded-lg border bg-card px-2 text-sm';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search statement or ref code…"
        defaultValue={sp.get('q') ?? ''}
        className="h-9 w-64"
        onKeyDown={(e) => {
          if (e.key === 'Enter') set('q', (e.target as HTMLInputElement).value);
        }}
      />
      <select className={select} value={sp.get('framework') ?? ''} onChange={(e) => set('framework', e.target.value)} aria-label="Framework">
        <option value="">All frameworks</option>
        {frameworks.map((f) => (
          <option key={f.id} value={f.id}>{f.code}</option>
        ))}
      </select>
      <select className={select} value={sp.get('subject') ?? ''} onChange={(e) => set('subject', e.target.value)} aria-label="Subject">
        <option value="">All subjects</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select className={select} value={sp.get('grade') ?? ''} onChange={(e) => set('grade', e.target.value)} aria-label="Grade">
        <option value="">All grades</option>
        {GRADES.map((g) => (
          <option key={g} value={g}>Grade {g}</option>
        ))}
      </select>
    </div>
  );
}
