import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Minutes a teacher would typically spend producing the equivalent by hand.
// These are stated assumptions, shown on the page and in the PDF, editable here.
export const MINUTES_PER_APPROVAL: Record<string, number> = {
  item: 12, paper: 90, artifact: 35, descriptor: 8, transition_report: 60, hpc_report: 20, demo_artifact: 5,
};

export interface LeadershipSummary {
  generatedAt: string;
  windowDays: number;
  generations: number;
  valid: number;
  redactions: number;
  avgLatencyMs: number;
  approvals: number;
  approvers: number;
  teachers: number;
  minutesSaved: number;
  byModule: { module: string; generations: number; valid: number }[];
  byType: { type: string; approvals: number; medianEdit: number; asGenerated: number; minutesEach: number; minutesSaved: number }[];
  editBuckets: { bucket: string; count: number }[];
  byProvider: { provider: string; count: number }[];
  byWeek: { week: string; generations: number; approvals: number }[];
}

const MODULE_OF = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes('setu') || k.includes('align') || k.includes('transition')) return 'SETU';
  if (k.includes('item') || k.includes('prashna') || k.includes('paper')) return 'PRASHNA';
  if (k.includes('descriptor') || k.includes('darpan') || k.includes('hpc')) return 'DARPAN';
  if (k.includes('uday') || k.includes('ct_ai')) return 'UDAY';
  return 'SAARTHI';
};
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const weekOf = (iso: string) => { const d = new Date(iso); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10); };

export async function buildLeadershipSummary(svc: SupabaseClient, schoolId: string, windowDays = 90): Promise<LeadershipSummary> {
  const since = new Date(Date.now() - windowDays * 86400_000).toISOString();
  const [{ data: gen }, { data: appr }, teachers] = await Promise.all([
    svc.from('generation_log').select('template_key, provider, validation_result, redaction_count, latency_ms, created_at').eq('school_id', schoolId).gte('created_at', since).limit(10000),
    svc.from('approvals').select('artifact_type, edit_distance, approved_by, approved_at').eq('school_id', schoolId).gte('approved_at', since).limit(10000),
    svc.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).in('role', ['teacher', 'hod']),
  ]);
  const g = (gen ?? []) as { template_key: string; provider: string; validation_result: string | null; redaction_count: number; latency_ms: number | null; created_at: string }[];
  const a = (appr ?? []) as { artifact_type: string; edit_distance: number | null; approved_by: string | null; approved_at: string }[];

  const mod = new Map<string, { generations: number; valid: number }>();
  const prov = new Map<string, number>();
  const weeks = new Map<string, { generations: number; approvals: number }>();
  for (const r of g) {
    const m = MODULE_OF(r.template_key);
    const cur = mod.get(m) ?? { generations: 0, valid: 0 };
    cur.generations++; if (r.validation_result !== 'invalid') cur.valid++;
    mod.set(m, cur);
    prov.set(r.provider, (prov.get(r.provider) ?? 0) + 1);
    const w = weekOf(r.created_at); const wk = weeks.get(w) ?? { generations: 0, approvals: 0 }; wk.generations++; weeks.set(w, wk);
  }
  const types = new Map<string, number[]>();
  for (const r of a) {
    types.set(r.artifact_type, [...(types.get(r.artifact_type) ?? []), r.edit_distance ?? 0]);
    const w = weekOf(r.approved_at); const wk = weeks.get(w) ?? { generations: 0, approvals: 0 }; wk.approvals++; weeks.set(w, wk);
  }
  const byType = [...types.entries()].map(([type, eds]) => {
    const minutesEach = MINUTES_PER_APPROVAL[type] ?? 10;
    return { type, approvals: eds.length, medianEdit: median(eds), asGenerated: eds.filter((e) => e === 0).length, minutesEach, minutesSaved: eds.length * minutesEach };
  }).sort((x, y) => y.approvals - x.approvals);
  const eds = a.map((r) => r.edit_distance ?? 0);
  const buckets = [['Approved as generated', (e: number) => e === 0], ['Light edit (1–20)', (e: number) => e > 0 && e <= 20], ['Reworked (21–100)', (e: number) => e > 20 && e <= 100], ['Rewritten (>100)', (e: number) => e > 100]] as const;

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    generations: g.length,
    valid: g.filter((r) => r.validation_result !== 'invalid').length,
    redactions: g.reduce((s, r) => s + (r.redaction_count ?? 0), 0),
    avgLatencyMs: g.length ? Math.round(g.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / g.length) : 0,
    approvals: a.length,
    approvers: new Set(a.map((r) => r.approved_by).filter(Boolean)).size,
    teachers: teachers.count ?? 0,
    minutesSaved: byType.reduce((s, t) => s + t.minutesSaved, 0),
    byModule: ['SETU', 'PRASHNA', 'SAARTHI', 'DARPAN', 'UDAY'].map((m) => ({ module: m, ...(mod.get(m) ?? { generations: 0, valid: 0 }) })),
    byType,
    editBuckets: buckets.map(([bucket, fn]) => ({ bucket, count: eds.filter(fn).length })),
    byProvider: [...prov.entries()].map(([provider, count]) => ({ provider, count })).sort((x, y) => y.count - x.count),
    byWeek: [...weeks.entries()].sort().map(([week, v]) => ({ week, ...v })),
  };
}
