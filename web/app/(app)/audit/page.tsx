import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { getT } from '@/lib/i18n/server';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createServiceClient } from '@/lib/supabase/service';

const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; entity?: string; page?: string }> }) {
  const user = (await getCurrentUser())!;
  if (!['principal', 'academic_head', 'super_admin'].includes(user.role)) redirect('/dashboard');
  const { t } = await getT();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  // audit_events grants no client-role select by design; the viewer reads it
  // server-side, scoped to the caller's tenant, after the role gate above.
  const svc = createServiceClient();
  let q = svc.from('audit_events').select('id, actor_role, action, entity_type, entity_id, payload, occurred_at, hash, prev_hash', { count: 'exact' }).eq('school_id', user.schoolId).order('id', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.action) q = q.ilike('action', `%${sp.action}%`);
  if (sp.entity) q = q.eq('entity_type', sp.entity);
  const [{ data: rows, count }, { data: chain }, { data: kinds }] = await Promise.all([
    q,
    svc.rpc('verify_chain', { p_school_id: user.schoolId }),
    svc.from('audit_events').select('entity_type').eq('school_id', user.schoolId).limit(3000),
  ]);
  const entities = [...new Set((kinds ?? []).map((k) => k.entity_type as string))].sort();
  const ok = chain === 'OK';
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) => `/audit?page=${p}${sp.action ? `&action=${encodeURIComponent(sp.action)}` : ''}${sp.entity ? `&entity=${encodeURIComponent(sp.entity)}` : ''}`;

  return (
    <div>
      <PageHeader
        eyebrow={`${total} events`}
        title={t('audit.title')}
        description={t('audit.sub')}
        actions={
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${ok ? 'bg-approved text-approved-foreground' : 'bg-rejected text-rejected-foreground'}`}>
            {ok ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />} {ok ? 'Chain verified' : String(chain)}
          </span>
        }
      />
      <form method="get" className="card-surface mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Action contains<input name="action" defaultValue={sp.action ?? ''} className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground" placeholder="approve" /></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Entity<select name="entity" defaultValue={sp.entity ?? ''} className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"><option value="">All</option>{entities.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
        <button type="submit" className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">Filter</button>
        <Link href="/audit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Clear</Link>
      </form>
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">When</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">Payload</th><th className="px-3 py-2">Hash</th></tr></thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="tabular px-3 py-2 text-muted-foreground">{r.id}</td>
                <td className="tabular whitespace-nowrap px-3 py-2">{new Date(r.occurred_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-3 py-2 capitalize">{(r.actor_role as string | null)?.replace(/_/g, ' ') ?? 'system'}</td>
                <td className="px-3 py-2 font-medium">{r.action}</td>
                <td className="px-3 py-2"><span className="text-muted-foreground">{r.entity_type}</span>{r.entity_id ? <span className="ml-1 font-mono text-[11px] text-muted-foreground">{String(r.entity_id).slice(0, 8)}</span> : null}</td>
                <td className="px-3 py-2">{Object.keys((r.payload as object) ?? {}).length ? <details><summary className="cursor-pointer text-xs text-primary">view</summary><pre className="mt-1 max-w-xs whitespace-pre-wrap font-mono text-[11px]">{JSON.stringify(r.payload, null, 1)}</pre></details> : <span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground" title={`prev ${r.prev_hash ?? '∅'}`}>{String(r.hash).slice(0, 10)}…</td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No events match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page} of {pages}</span>
        <span className="flex gap-3">{page > 1 && <Link href={link(page - 1)} className="text-primary">← Newer</Link>}{page < pages && <Link href={link(page + 1)} className="text-primary">Older →</Link>}</span>
      </div>
    </div>
  );
}
