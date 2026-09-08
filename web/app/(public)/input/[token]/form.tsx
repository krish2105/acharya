'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PARENT_FORM, UI } from '@/lib/darpan/forms';
import { submitParentInput } from './actions';

export function ParentTokenForm({ token, childFirstName, guardian, school, term }: { token: string; childFirstName: string; guardian: string; school: string; term: string }) {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="mt-4 rounded-lg bg-approved px-3 py-2 text-sm text-approved-foreground">{UI.submitted[lang]}</p>;
  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const responses: Record<string, string> = {};
        for (const f of PARENT_FORM) responses[f.key] = String(fd.get(f.key) ?? '');
        start(async () => {
          try {
            await submitParentInput(token, responses, lang, fd.get('consent') === 'on');
            setDone(true);
          } catch (err) {
            setError((err as Error).message);
          }
        });
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-medium">{lang === 'en' ? `About ${childFirstName} · ${term}` : `${childFirstName} के बारे में · ${term}`}</h1>
          <p className="text-xs text-muted-foreground">{school} · {lang === 'en' ? `For ${guardian}` : `${guardian} के लिए`}</p>
        </div>
        <button type="button" className="text-xs text-primary underline-offset-4 hover:underline" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>{UI.language[lang]}</button>
      </div>
      {PARENT_FORM.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm">
          <span>{f.label[lang]}</span>
          <Textarea name={f.key} rows={2} required className="min-h-11 text-base" />
        </label>
      ))}
      <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" name="consent" required className="mt-0.5 accent-primary" /> {UI.consent[lang]}</label>
      {error && <p role="alert" className="rounded-lg bg-rejected px-3 py-2 text-sm text-rejected-foreground">{error}</p>}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>{UI.submit[lang]}</Button>
    </form>
  );
}
