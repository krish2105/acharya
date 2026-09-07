'use client';

import { useState } from 'react';

export interface FrameworkOption {
  id: string;
  code: string;
  name: string;
}

/**
 * App-shell scaffold for Section 8 task 10. Selecting a framework doesn't
 * filter anything yet -- SETU/PRASHNA/etc. views that would honor this
 * selection don't exist until later phases.
 */
export function FrameworkSwitcher({ frameworks }: { frameworks: FrameworkOption[] }) {
  const [selected, setSelected] = useState(frameworks[0]?.id ?? '');

  if (frameworks.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="framework-switcher" className="text-xs font-medium text-muted-foreground">
        Framework
      </label>
      <select
        id="framework-switcher"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-md border bg-background px-2 py-1.5 text-sm"
      >
        {frameworks.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </div>
  );
}
