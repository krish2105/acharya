import Link from 'next/link';
import { PageHeader, StatTile } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { RunCalibrationButton } from './run-button';
import { PRASHNA_TABS, label } from '../nav';

export default async function CalibrationPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('item_stats')
    .select('item_id, attempts, facility, discrimination, difficulty_observed, flagged, last_computed_on, items(stem, item_type, difficulty_intended, cognitive_level)')
    .order('flagged', { ascending: false })
    .order('facility');
  type Row = { item_id: string; attempts: number; facility: number; discrimination: number; difficulty_observed: string; flagged: boolean; last_computed_on: string; items: { stem: string; item_type: string; difficulty_intended: string | null; cognitive_level: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  const flagged = rows.filter((r) => r.flagged);

  return (
    <div>
      <PageHeader
        eyebrow="PRASHNA"
        title="Difficulty calibration"
        description="Facility (share scoring full marks) and discrimination (top third vs bottom third) per item from real response data. Items behaving differently from their label are flagged. Runs nightly at 02:00 on pg_cron."
        tabs={PRASHNA_TABS}
        current="/prashna/calibration"
        actions={<RunCalibrationButton />}
      />
      <div className="mb-4 grid grid-cols-3 gap-4">
        <StatTile label="Items with data" value={rows.length} />
        <StatTile label="Flagged" value={flagged.length} tone={flagged.length ? 'rejected' : 'approved'} hint="observed ≠ intended" />
        <StatTile label="Last computed" value={rows[0]?.last_computed_on ?? '—'} />
      </div>
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Item</th><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2 font-medium text-right">Attempts</th><th className="px-4 py-2 font-medium text-right">Facility</th><th className="px-4 py-2 font-medium text-right">Discrim.</th><th className="px-4 py-2 font-medium">Intended</th><th className="px-4 py-2 font-medium">Observed</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item_id} className={`border-t ${r.flagged ? 'bg-rejected/40' : ''}`}>
                <td className="max-w-md px-4 py-2"><Link href={`/prashna/bank/${r.item_id}`} className="line-clamp-1 hover:text-primary">{r.items?.stem}</Link></td>
                <td className="px-4 py-2 capitalize text-muted-foreground">{label(r.items?.item_type ?? '')}</td>
                <td className="px-4 py-2 text-right tabular">{r.attempts}</td>
                <td className="px-4 py-2 text-right tabular">{Number(r.facility).toFixed(2)}</td>
                <td className="px-4 py-2 text-right tabular">{Number(r.discrimination).toFixed(2)}</td>
                <td className="px-4 py-2 capitalize">{r.items?.difficulty_intended ?? '—'}</td>
                <td className="px-4 py-2 capitalize">{r.flagged ? <span className="rounded-full bg-rejected px-2 py-0.5 text-[11px] font-medium text-rejected-foreground">{r.difficulty_observed}</span> : r.difficulty_observed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
