import { redirect } from 'next/navigation';
import { Counter, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shared/page-header';
import { getT } from '@/lib/i18n/server';
import { buildLeadershipSummary } from '@/lib/leadership';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createServiceClient } from '@/lib/supabase/service';
import { ExportButton, LeadershipCharts } from './charts';

export default async function LeadershipPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = (await getCurrentUser())!;
  if (!['principal', 'academic_head'].includes(user.role)) redirect('/dashboard');
  const { t } = await getT();
  const days = Math.min(365, Math.max(7, Number((await searchParams).days ?? 90) || 90));
  const s = await buildLeadershipSummary(createServiceClient(), user.schoolId, days);
  const hours = Math.round(s.minutesSaved / 60);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={`Last ${days} days`} title={t('leadership.title')} description={t('leadership.sub')} actions={<ExportButton windowDays={days} />} />
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4" stagger={0.05}>
        {[
          { label: 'AI drafts generated', value: s.generations, hint: `${s.valid} schema-valid` },
          { label: 'Teacher approvals', value: s.approvals, hint: `${s.approvers} of ${s.teachers} teaching staff approving` },
          { label: 'Teacher hours saved (est.)', value: hours, hint: 'assumptions below', tone: 'approved' as const },
          { label: 'PII spans redacted', value: s.redactions, hint: '0 reached a model', tone: 'approved' as const },
        ].map((k) => (
          <StaggerItem key={k.label} className="card-surface flex flex-col gap-1 p-5">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`font-display text-4xl font-medium tracking-tight ${k.tone === 'approved' ? 'text-approved-foreground' : ''}`}><Counter value={k.value} /></p>
            <p className="text-xs text-muted-foreground">{k.hint}</p>
          </StaggerItem>
        ))}
      </Stagger>
      <LeadershipCharts s={s} />
      <section className="card-surface overflow-x-auto p-5">
        <h3 className="mb-1 text-sm font-medium">Time-saved assumptions</h3>
        <p className="mb-3 text-xs text-muted-foreground">Minutes a teacher would spend producing each kind by hand. Stated, not hidden; change them in <code>web/lib/leadership.ts</code>.</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1.5 pr-3">Kind</th><th className="py-1.5 pr-3">Approvals</th><th className="py-1.5 pr-3">Approved as generated</th><th className="py-1.5 pr-3">Median edit distance</th><th className="py-1.5 pr-3">Minutes each</th><th className="py-1.5">Minutes saved</th></tr></thead>
          <tbody>
            {s.byType.map((r) => <tr key={r.type} className="border-t"><td className="py-1.5 pr-3 capitalize">{r.type.replace(/_/g, ' ')}</td><td className="tabular py-1.5 pr-3">{r.approvals}</td><td className="tabular py-1.5 pr-3">{r.asGenerated}</td><td className="tabular py-1.5 pr-3">{r.medianEdit}</td><td className="tabular py-1.5 pr-3">{r.minutesEach}</td><td className="tabular py-1.5">{r.minutesSaved}</td></tr>)}
          </tbody>
        </table>
      </section>
    </div>
  );
}
