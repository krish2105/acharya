import Link from 'next/link';
import { Counter, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { RunEngineButton } from './run-engine-button';
import { SETU_TABS } from './nav';

export default async function SetuOverview() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const [outcomes, concepts, confirmed, pending, xa, byFramework] = await Promise.all([
    supabase.from('learning_outcomes').select('id', { count: 'exact', head: true }),
    supabase.from('concepts').select('id', { count: 'exact', head: true }).not('parent_id', 'is', null),
    supabase.from('outcome_concepts').select('learning_outcome_id', { count: 'exact', head: true }).eq('method', 'human_confirmed'),
    supabase.from('outcome_concepts').select('learning_outcome_id', { count: 'exact', head: true }).neq('method', 'human_confirmed'),
    supabase.from('cross_alignments').select('id', { count: 'exact', head: true }).not('confirmed_at', 'is', null),
    supabase.from('learning_outcomes').select('framework_id, frameworks(code, name)'),
  ]);

  const fwCounts = new Map<string, { name: string; n: number }>();
  for (const r of (byFramework.data ?? []) as unknown as { framework_id: string; frameworks: { code: string; name: string } | null }[]) {
    const key = r.frameworks?.code ?? r.framework_id;
    fwCounts.set(key, { name: r.frameworks?.name ?? key, n: (fwCounts.get(key)?.n ?? 0) + 1 });
  }

  const tiles = [
    { label: 'Learning outcomes', value: outcomes.count ?? 0, tone: '' },
    { label: 'Canonical concepts', value: concepts.count ?? 0, tone: '' },
    { label: 'Human-confirmed links', value: confirmed.count ?? 0, tone: 'text-approved-foreground' },
    { label: 'Awaiting confirmation', value: pending.count ?? 0, tone: 'text-pending-foreground' },
    { label: 'Cross-framework equivalents', value: xa.count ?? 0, tone: '' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="SETU · bridge"
        title="One concept graph, four boards."
        description="Every other module resolves against this spine. AI proposes links; only human-confirmed links count for coverage and generation."
        tabs={SETU_TABS}
        current="/setu"
        actions={
          <>
            <Button variant="outline" render={<Link href="/setu/outcomes?import=1" />} nativeButton={false}>
              Import framework
            </Button>
            <RunEngineButton />
          </>
        }
      />

      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-5" stagger={0.05}>
        {tiles.map((t) => (
          <StaggerItem key={t.label} className="card-surface flex flex-col gap-1 p-5">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className={`font-display text-3xl font-medium tracking-tight ${t.tone}`}>
              <Counter value={t.value} />
            </p>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card-surface p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Outcomes by framework</h3>
          <ul className="flex flex-col gap-2">
            {[...fwCounts.entries()].sort((a, b) => b[1].n - a[1].n).map(([code, v]) => {
              const max = Math.max(...[...fwCounts.values()].map((x) => x.n));
              return (
                <li key={code} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="truncate">
                    <span className="font-mono text-xs text-primary">{code}</span> <span className="text-muted-foreground">{v.name}</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(v.n / max) * 100}%` }} />
                  </span>
                  <span className="tabular text-right">{v.n}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card-surface p-5">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Next actions</h3>
          <ul className="flex flex-col gap-2 text-sm">
            <li><Link className="text-primary underline-offset-4 hover:underline" href="/setu/alignment">Confirm {pending.count ?? 0} proposed links</Link></li>
            <li><Link className="text-primary underline-offset-4 hover:underline" href="/setu/alignment/cross">Review cross-framework equivalents</Link></li>
            <li><Link className="text-primary underline-offset-4 hover:underline" href="/setu/coverage">Check coverage for your sections</Link></li>
            <li><Link className="text-primary underline-offset-4 hover:underline" href="/setu/transitions">Generate a board-transition report</Link></li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Signed in as {user.role.replace('_', ' ')}. Teachers propose; heads, coordinators and HODs confirm.</p>
        </section>
      </div>
    </div>
  );
}
