import Link from 'next/link';
import { Counter, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { PRASHNA_TABS, label } from './nav';

export default async function PrashnaOverview() {
  const user = (await getCurrentUser())!;
  const supabase = await createClient();
  const [approved, pending, drafts, flagged, papers, byType] = await Promise.all([
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('item_stats').select('item_id', { count: 'exact', head: true }).eq('flagged', true),
    supabase.from('papers').select('id', { count: 'exact', head: true }),
    supabase.from('items').select('item_type').eq('status', 'approved'),
  ]);
  const typeCounts = new Map<string, number>();
  for (const r of byType.data ?? []) typeCounts.set(r.item_type, (typeCounts.get(r.item_type) ?? 0) + 1);
  const max = Math.max(1, ...typeCounts.values());

  return (
    <div>
      <PageHeader
        eyebrow="PRASHNA · question"
        title="A blueprint-compliant paper in under ten minutes."
        description="Competency items generated from outcomes, approved by an HOD, assembled into papers by constraint — never by guessing."
        tabs={PRASHNA_TABS}
        current="/prashna"
        actions={
          <>
            <Button variant="outline" render={<Link href="/prashna/papers?assemble=1" />} nativeButton={false}>Assemble a paper</Button>
            <Button render={<Link href="/prashna/generate" />} nativeButton={false}>Generate items</Button>
          </>
        }
      />
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-5" stagger={0.05}>
        {[
          { l: 'Approved bank', v: approved.count ?? 0, t: 'text-approved-foreground' },
          { l: 'Pending HOD review', v: pending.count ?? 0, t: 'text-pending-foreground' },
          { l: 'Teacher drafts', v: drafts.count ?? 0, t: '' },
          { l: 'Flagged by calibration', v: flagged.count ?? 0, t: flagged.count ? 'text-rejected-foreground' : '' },
          { l: 'Papers', v: papers.count ?? 0, t: '' },
        ].map((s) => (
          <StaggerItem key={s.l} className="card-surface flex flex-col gap-1 p-5">
            <p className="text-xs text-muted-foreground">{s.l}</p>
            <p className={`font-display text-3xl font-medium tracking-tight ${s.t}`}><Counter value={s.v} /></p>
          </StaggerItem>
        ))}
      </Stagger>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card-surface p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Approved bank by item type</h3>
          <ul className="flex flex-col gap-2">
            {[...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
              <li key={t} className="grid grid-cols-[11rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="capitalize">{label(t)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} /></span>
                <span className="tabular text-right">{n}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card-surface p-5">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Next actions</h3>
          <ul className="flex flex-col gap-2 text-sm">
            <li><Link className="text-primary underline-offset-4 hover:underline" href="/prashna/review">Review {pending.count ?? 0} items awaiting HOD approval</Link></li>
            <li><Link className="text-primary underline-offset-4 hover:underline" href="/prashna/calibration">Inspect {flagged.count ?? 0} items behaving unlike their label</Link></li>
            <li><Link className="text-primary underline-offset-4 hover:underline" href="/prashna/papers">Open the main/improvement paper pair</Link></li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Signed in as {user.role.replace('_', ' ')}.</p>
        </section>
      </div>
    </div>
  );
}
