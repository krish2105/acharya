import Link from 'next/link';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Counter, Stagger, StaggerItem } from '@/components/motion/primitives';
import { MODULE_NAV } from '@/lib/navigation';
import { getDashboardStats } from '@/lib/dashboard';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { NavIcon } from '@/components/shell/icons';
import { ApproveButton } from './approve-button';

const DEMO_OUTCOME = {
  frameworkCode: 'CBSE',
  refCode: 'CBSE.SCI.10.4.2',
  statement: 'Explain the process of photosynthesis in green plants and its significance.',
};
const DEMO_FINAL_TEXT = 'Photosynthesis converts light energy into chemical energy, stored as glucose, which plants use to grow.';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const MODULE_LABEL: Record<string, string> = { setu: 'Curriculum spine', prashna: 'Items & papers', saarthi: 'Teacher copilot', darpan: 'Progress cards', uday: 'AI & CT programme' };

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const [stats, { data: artifact }] = await Promise.all([
    getDashboardStats(supabase, user.schoolId),
    supabase
      .from('demo_artifacts')
      .select('id, title, generated_version, status')
      .eq('school_id', user.schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{today}</p>
          <h2 className="font-display text-display-md font-medium tracking-tight">
            {greeting()}, {user.fullName.split(' ')[0]}.
          </h2>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-approved px-3 py-1 text-xs font-medium text-approved-foreground">
          <ShieldCheck className="size-3.5" /> {stats.redactions} PII spans redacted · 0 reached a model
        </p>
      </div>

      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4" stagger={0.05}>
        {[
          { label: 'Awaiting your approval', value: stats.pendingApprovals, tone: 'pending' as const },
          { label: 'Approved artifacts', value: stats.approved, tone: 'approved' as const },
          { label: 'AI drafts generated', value: stats.generations, tone: 'neutral' as const },
          { label: 'Students in scope', value: stats.students, tone: 'neutral' as const },
        ].map((s) => (
          <StaggerItem key={s.label} className="card-surface flex flex-col gap-1 p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`font-display text-4xl font-medium tracking-tight ${s.tone === 'pending' ? 'text-pending-foreground' : s.tone === 'approved' ? 'text-approved-foreground' : ''}`}>
              <Counter value={s.value} />
            </p>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Approval queue</h3>
          {artifact ? (
            <ApproveButton
              artifactId={artifact.id}
              title={artifact.title}
              outcome={DEMO_OUTCOME}
              generatedText={(artifact.generated_version as { text: string }).text}
              finalText={DEMO_FINAL_TEXT}
              approved={artifact.status === 'approved'}
            />
          ) : (
            <div className="card-surface p-8 text-center text-sm text-muted-foreground">Nothing awaiting approval.</div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="card-surface p-5">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Recent activity</h3>
            {stats.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {stats.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium capitalize">{a.action.replace(/_/g, ' ')}</span>{' '}
                      <span className="text-muted-foreground">
                        {a.entityType.replace(/_/g, ' ')}
                        {a.actorRole ? ` · ${a.actorRole.replace(/_/g, ' ')}` : ''}
                      </span>
                      <span className="block text-xs text-muted-foreground">{new Date(a.at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card-surface p-5">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Modules</h3>
            <ul className="grid grid-cols-1 gap-1.5">
              {MODULE_NAV.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-accent">
                    <span className="grid size-8 place-items-center rounded-md bg-secondary text-navy">
                      <NavIcon name={m.icon} className="size-4" />
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{m.labelKey.replace('nav.', '').toUpperCase()}</span>
                      <span className="block text-xs text-muted-foreground">{MODULE_LABEL[m.module ?? '']}</span>
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
