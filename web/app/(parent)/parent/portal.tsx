'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileDown, FileJson, LogOut, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PARENT_FORM, UI } from '@/lib/darpan/forms';
import { createClient } from '@/lib/supabase/client';
import { parentExportData, parentRequestErasure, parentSignedUrl, submitPortalParentInput } from './actions';

const TERM = 'T1 2026-27';
interface Child { id: string; full_name: string; admission_no: string; sections: { grade: string; section: string } | null }
interface Report { id: string; student_id: string; term: string; stage: string; file_path: string | null; released_to_parent_at: string }

export function ParentPortal({ user, kids, reports, inputs, consents }: { user: { fullName: string; schoolName: string }; kids: Child[]; reports: Report[]; inputs: { student_id: string; term: string }[]; consents: { student_id: string; purpose: string; granted: boolean; withdrawn_at: string | null; consent_version: string }[] }) {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = (en: string, hi: string) => (lang === 'en' ? en : hi);
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{user.schoolName}</p>
          <h1 className="font-display text-2xl font-medium">{t('Parent portal', 'अभिभावक पोर्टल')} · {user.fullName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="text-xs text-primary underline-offset-4 hover:underline" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>{UI.language[lang]}</button>
          <Button variant="outline" size="sm" onClick={async () => { await createClient().auth.signOut(); router.push('/login'); router.refresh(); }}><LogOut className="size-4" /> {t('Sign out', 'साइन आउट')}</Button>
        </div>
      </header>

      {kids.map((c) => {
        const myReports = reports.filter((r) => r.student_id === c.id);
        const submitted = inputs.some((i) => i.student_id === c.id && i.term === TERM);
        const myConsents = consents.filter((x) => x.student_id === c.id);
        return (
          <section key={c.id} className="mb-6 flex flex-col gap-4">
            <div className="card-surface p-5">
              <h2 className="font-display text-xl font-medium">{c.full_name}</h2>
              <p className="text-xs text-muted-foreground">{c.admission_no} · {t('Grade', 'कक्षा')} {c.sections?.grade}{c.sections?.section}</p>
            </div>
            <div className="card-surface p-5">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t('Released progress cards', 'जारी प्रगति पत्र')}</h3>
              {myReports.length === 0 && <p className="text-sm text-muted-foreground">{t('No report released yet.', 'अभी कोई रिपोर्ट जारी नहीं हुई।')}</p>}
              <ul className="flex flex-col gap-2">
                {myReports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{r.term} · <span className="capitalize">{r.stage}</span> {t('stage', 'चरण')} · {new Date(r.released_to_parent_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}</span>
                    {r.file_path ? (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { try { const u = await parentSignedUrl(r.file_path!); window.open(u, '_blank', 'noopener'); } catch (e) { toast.error((e as Error).message); } })}><FileDown className="size-4" /> PDF</Button>
                    ) : <span className="text-xs text-muted-foreground">{t('PDF being prepared', 'PDF तैयार हो रही है')}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-surface p-5">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t(`Your input for ${TERM}`, `${TERM} के लिए आपका इनपुट`)}</h3>
              {submitted ? <p className="text-sm text-approved-foreground">{UI.submitted[lang]}</p> : (
                <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const responses: Record<string, string> = {}; for (const f of PARENT_FORM) responses[f.key] = String(fd.get(f.key) ?? ''); start(async () => { try { await submitPortalParentInput(c.id, TERM, responses, lang); toast.success(UI.submitted[lang]); router.refresh(); } catch (err) { toast.error((err as Error).message); } }); }}>
                  {PARENT_FORM.map((f) => <label key={f.key} className="flex flex-col gap-1 text-sm"><span>{f.label[lang]}</span><Textarea name={f.key} rows={2} required className="min-h-11 text-base" /></label>)}
                  <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" required className="mt-0.5 accent-primary" /> {UI.consent[lang]}</label>
                  <Button type="submit" size="lg" className="h-11" disabled={pending}>{UI.submit[lang]}</Button>
                </form>
              )}
            </div>
            <div className="card-surface p-5">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t('Consent on file', 'दर्ज सहमति')}</h3>
              <ul className="flex flex-wrap gap-2 text-xs">
                {myConsents.map((x, i) => <li key={i} className={`rounded-full px-2 py-0.5 ${x.granted && !x.withdrawn_at ? 'bg-approved text-approved-foreground' : 'bg-muted text-muted-foreground'}`}>{x.purpose.replace('_', ' ')} · {x.consent_version}</li>)}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { try { const u = await parentExportData(c.id); window.open(u, '_blank', 'noopener'); } catch (e) { toast.error((e as Error).message); } })}><FileJson className="size-4" /> {t('Download all data held', 'रखा गया सारा डेटा डाउनलोड करें')}</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => { const reason = window.prompt(t('Why should this data be erased? The school will review the request.', 'यह डेटा क्यों मिटाया जाए? विद्यालय अनुरोध की समीक्षा करेगा।')); if (reason !== null) start(async () => { try { await parentRequestErasure(c.id, reason); toast.success(t('Erasure request sent to the school', 'मिटाने का अनुरोध विद्यालय को भेजा गया')); } catch (e) { toast.error((e as Error).message); } }); }}><UserX className="size-4" /> {t('Request erasure', 'मिटाने का अनुरोध')}</Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{t('Rights under the Digital Personal Data Protection Act, 2023.', 'डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के अंतर्गत अधिकार।')}</p>
            </div>
          </section>
        );
      })}
      {kids.length === 0 && <p className="text-sm text-muted-foreground">{t('No child is linked to this account yet.', 'इस खाते से अभी कोई बच्चा जुड़ा नहीं है।')}</p>}
    </main>
  );
}
