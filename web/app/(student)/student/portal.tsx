'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PEER_FORM, SELF_FORM, UI } from '@/lib/darpan/forms';
import { createClient } from '@/lib/supabase/client';
import { submitPeerInput, submitSelfInput, uploadProject } from './actions';
import { Input } from '@/components/ui/input';

const TERM = 'T1 2026-27';

export function StudentPortal({ user, me, selfInputs, peerReceived, classmates, projects, units }: { user: { fullName: string; schoolName: string }; me: { id: string; full_name: string; sections: { grade: string; section: string } | null } | null; selfInputs: { term: string; responses: Record<string, string> }[]; peerReceived: { term: string; responses: Record<string, string>; submitted_at: string }[]; classmates: { id: string; full_name: string }[]; projects: { id: string; title: string | null; rubric_scores: Record<string, number> | null; teacher_comment: string | null; assessed_on: string | null; submitted_at: string | null; ct_ai_units: { title: string } | null }[]; units: { id: string; title: string; sequence_no: number }[] }) {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [pending, start] = useTransition();
  const [peer, setPeer] = useState(classmates[0]?.id ?? '');
  const router = useRouter();
  const t = (en: string, hi: string) => (lang === 'en' ? en : hi);
  const selfDone = selfInputs.some((s) => s.term === TERM);
  const wrap = (fn: () => Promise<unknown>) => start(async () => { try { await fn(); toast.success(UI.submitted[lang]); router.refresh(); } catch (e) { toast.error((e as Error).message); } });

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{user.schoolName}{me?.sections ? ` · ${t('Grade', 'कक्षा')} ${me.sections.grade}${me.sections.section}` : ''}</p>
          <h1 className="font-display text-2xl font-medium">{t('Hi', 'नमस्ते')}, {user.fullName.split(' ')[0]}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="text-xs text-primary underline-offset-4 hover:underline" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>{UI.language[lang]}</button>
          <Button variant="outline" size="sm" onClick={async () => { await createClient().auth.signOut(); router.push('/login'); router.refresh(); }}><LogOut className="size-4" /> {t('Sign out', 'साइन आउट')}</Button>
        </div>
      </header>

      <section className="card-surface mb-4 p-5">
        <h2 className="mb-2 font-display text-lg font-medium">{t('My self-assessment', 'मेरा स्व-मूल्यांकन')} · {TERM}</h2>
        {selfDone ? <p className="text-sm text-approved-foreground">{UI.submitted[lang]}</p> : (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const r: Record<string, string> = {}; for (const f of SELF_FORM) r[f.key] = String(fd.get(f.key) ?? ''); wrap(() => submitSelfInput(TERM, r, lang)); }}>
            {SELF_FORM.map((f) => <label key={f.key} className="flex flex-col gap-1 text-sm"><span>{f.label[lang]}</span><Textarea name={f.key} rows={2} required className="min-h-11 text-base" /></label>)}
            <Button type="submit" size="lg" className="h-11" disabled={pending}>{UI.submit[lang]}</Button>
          </form>
        )}
      </section>

      <section className="card-surface mb-4 p-5">
        <h2 className="mb-1 font-display text-lg font-medium">{t('Say something kind and true about a classmate', 'किसी सहपाठी के बारे में कुछ अच्छा और सच्चा कहें')}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t('Your classmate will see what you wrote, but not your name. Your teacher can see who wrote it.', 'आपका सहपाठी आपकी बात देखेगा, पर आपका नाम नहीं। शिक्षक देख सकते हैं कि किसने लिखा।')}</p>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const r: Record<string, string> = {}; for (const f of PEER_FORM) r[f.key] = String(fd.get(f.key) ?? ''); wrap(() => submitPeerInput(peer, TERM, r, lang)); (e.target as HTMLFormElement).reset(); }}>
          <select className="h-11 rounded-lg border bg-card px-2 text-sm" value={peer} onChange={(e) => setPeer(e.target.value)} aria-label="Classmate">{classmates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select>
          {PEER_FORM.map((f) => <label key={f.key} className="flex flex-col gap-1 text-sm"><span>{f.label[lang]}</span><Textarea name={f.key} rows={2} required className="min-h-11 text-base" /></label>)}
          <Button type="submit" size="lg" className="h-11" disabled={pending || !peer}>{UI.submit[lang]}</Button>
        </form>
      </section>

      <section className="card-surface mb-4 p-5">
        <h2 className="mb-1 font-display text-lg font-medium">{t('My AI & CT projects', 'मेरे AI व CT प्रोजेक्ट')}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t('Upload your project artefact. Your teacher scores it with the rubric and writes a comment.', 'अपना प्रोजेक्ट अपलोड करें। शिक्षक रूब्रिक से अंक देंगे और टिप्पणी लिखेंगे।')}</p>
        <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const form = e.currentTarget; wrap(async () => { await uploadProject(fd); form.reset(); }); }}>
          <label className="flex flex-1 flex-col gap-1 text-sm"><span>{t('Title', 'शीर्षक')}</span><Input name="title" required className="h-11" /></label>
          <label className="flex flex-col gap-1 text-sm"><span>{t('Unit', 'इकाई')}</span><select name="unit_id" className="h-11 rounded-lg border bg-card px-2 text-sm">{units.map((u) => <option key={u.id} value={u.id}>{u.sequence_no}. {u.title}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm"><span>{t('File', 'फ़ाइल')}</span><Input name="artefact" type="file" required className="h-11" /></label>
          <Button type="submit" size="lg" className="h-11" disabled={pending}>{t('Upload', 'अपलोड')}</Button>
        </form>
        <ul className="flex flex-col gap-2">
          {projects.map((p) => (
            <li key={p.id} className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="font-medium">{p.title} <span className="text-xs text-muted-foreground">· {p.ct_ai_units?.title}</span></p>
              {p.assessed_on ? <p className="text-xs">{Object.entries(p.rubric_scores ?? {}).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}<br /><span className="text-muted-foreground">{p.teacher_comment}</span></p> : <p className="text-xs text-pending-foreground">{t('Awaiting teacher assessment', 'शिक्षक के मूल्यांकन की प्रतीक्षा')}</p>}
            </li>
          ))}
          {projects.length === 0 && <li className="text-sm text-muted-foreground">{t('No projects yet.', 'अभी कोई प्रोजेक्ट नहीं।')}</li>}
        </ul>
      </section>

      <section className="card-surface p-5">
        <h2 className="mb-2 font-display text-lg font-medium">{t('What classmates noticed about you', 'सहपाठियों ने आपके बारे में क्या देखा')}</h2>
        {peerReceived.length === 0 ? <p className="text-sm text-muted-foreground">{t('Nothing yet.', 'अभी कुछ नहीं।')}</p> : (
          <ul className="flex flex-col gap-3">
            {peerReceived.map((p, i) => (
              <li key={i} className="rounded-lg bg-muted/40 p-3 text-sm">
                {Object.entries(p.responses).map(([k, v]) => <p key={k}><span className="text-xs text-muted-foreground">{PEER_FORM.find((f) => f.key === k)?.label[lang] ?? k}:</span> {v}</p>)}
                <p className="mt-1 text-[11px] text-muted-foreground">{t('Anonymous classmate', 'अनाम सहपाठी')} · {p.term}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
