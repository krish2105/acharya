'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ApprovalCard } from '@/components/shared/approval-card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { approveDescriptor, draftDescriptor, saveDescriptor } from '../../actions';
import { DOMAIN_LABEL } from '../../nav';

interface Desc { id: string; domain: string; generated_text: string | null; generated_json: { strengths: string[]; growth_areas: string[]; next_step: string } | null; final_text: string | null; status: string; language: string }

export function DescriptorEditor({ studentId, term, domains, descriptors, evidenceByDomain, totalEvidence }: { studentId: string; term: string; domains: string[]; descriptors: Desc[]; evidenceByDomain: Record<string, number>; totalEvidence: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState<Record<string, string>>(Object.fromEntries(descriptors.map((d) => [d.domain, d.final_text ?? d.generated_text ?? ''])));
  const [language, setLanguage] = useState<'en' | 'hi'>('en');

  const run = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(null);
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">Drafts use only redacted evidence: your observations, this child&apos;s outcome-linked performance, and the 360° inputs. No comparison, diagnosis or prediction survives post-validation.</p>
        <select className="h-9 rounded-lg border bg-card px-2 text-sm" value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'hi')} aria-label="Draft language"><option value="en">English</option><option value="hi">हिन्दी</option></select>
      </div>
      {domains.map((domain) => {
        const d = descriptors.find((x) => x.domain === domain);
        const approved = d?.status === 'approved';
        return (
          <section key={domain} className="flex flex-col gap-3">
            {d ? (
              <>
                <ApprovalCard
                  title={DOMAIN_LABEL[domain].en}
                  outcome={{ frameworkCode: 'HPC', refCode: domain.replace('_', '-'), statement: DOMAIN_LABEL[domain].hi }}
                  generatedText={d.generated_text ?? ''}
                  finalText={text[domain] ?? ''}
                  approved={approved}
                  meta={`${evidenceByDomain[domain] ?? 0} observation(s) in this domain · ${d.language === 'hi' ? 'हिन्दी' : 'English'}`}
                  onApprove={approved ? undefined : () => new Promise<void>((resolve) => { run(() => approveDescriptor(d.id, text[domain] ?? ''), 'Descriptor approved'); resolve(); })}
                />
                {!approved && (
                  <div className="flex flex-col gap-2">
                    <Textarea rows={4} value={text[domain] ?? ''} onChange={(e) => setText({ ...text, [domain]: e.target.value })} />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => saveDescriptor(d.id, text[domain] ?? ''), 'Saved')}>Save edit</Button>
                      <Button variant="ghost" size="sm" disabled={pending || busy === domain} onClick={() => { setBusy(domain); run(() => draftDescriptor(studentId, term, domain, language), 'Re-drafted'); }}>
                        {busy === domain ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Re-draft
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="card-surface flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-display text-lg font-medium">{DOMAIN_LABEL[domain].en}</p>
                  <p className="text-xs text-muted-foreground">{evidenceByDomain[domain] ?? 0} observation(s) in this domain · {totalEvidence} pieces of evidence overall</p>
                </div>
                <Button disabled={pending || busy === domain || totalEvidence === 0} title={totalEvidence === 0 ? 'Record an observation first' : undefined} onClick={() => { setBusy(domain); run(() => draftDescriptor(studentId, term, domain, language), 'Draft ready'); }}>
                  {busy === domain ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Draft with AI
                </Button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
