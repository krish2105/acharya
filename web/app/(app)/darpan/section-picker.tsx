'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function SectionPicker({ sections, current, terms = ['T1 2026-27', 'T2 2026-27'], term }: { sections: { id: string; label: string }[]; current: string; terms?: string[]; term: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const go = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    n.set(k, v);
    router.push(`${pathname}?${n.toString()}`);
  };
  return (
    <div className="flex items-center gap-2">
      <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={current} onChange={(e) => go('section', e.target.value)} aria-label="Section">
        {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={term} onChange={(e) => go('term', e.target.value)} aria-label="Term">
        {terms.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}
