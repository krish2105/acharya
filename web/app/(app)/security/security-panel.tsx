'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, MonitorSmartphone, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

interface Factor { id: string; friendly_name?: string | null; factor_type: string; status: string; created_at: string }
interface Session { id: string; created_at: string; updated_at: string; user_agent: string | null; ip: string | null; aal: string | null }

function sessionIdFromToken(token?: string | null) {
  try {
    return token ? (JSON.parse(atob(token.split('.')[1])) as { session_id?: string }).session_id ?? null : null;
  } catch {
    return null;
  }
}

export function SecurityPanel({ mfaRequired }: { mfaRequired: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [aal, setAal] = useState<{ current: string | null; next: string | null } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mine, setMine] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const [{ data: f }, { data: a }, { data: s }, { data: sess }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.from('my_sessions').select('*').order('updated_at', { ascending: false }),
      supabase.auth.getSession(),
    ]);
    setFactors(((f?.all ?? []) as Factor[]).filter((x) => x.factor_type === 'totp'));
    setAal(a ? { current: a.currentLevel, next: a.nextLevel } : null);
    setSessions((s ?? []) as Session[]);
    setMine(sessionIdFromToken(sess.session?.access_token));
  }, [supabase]);
  useEffect(() => { void load(); }, [load]);

  const startEnroll = () => start(async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toLocaleDateString('en-IN')}` });
    if (error || !data) { toast.error(error?.message ?? 'Could not start enrolment'); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  });
  const verify = () => start(async () => {
    if (!enroll) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success('Two-factor authentication is on');
    setEnroll(null); setCode('');
    await load();
    router.refresh();
  });
  const unenroll = (id: string) => start(async () => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) { toast.error(error.message); return; }
    toast.success('Factor removed');
    await load();
    router.refresh();
  });
  const revoke = (id: string) => start(async () => {
    const { error } = await supabase.rpc('revoke_my_session', { p_session_id: id });
    if (error) { toast.error(error.message); return; }
    if (id === mine) { await supabase.auth.signOut(); router.push('/login'); router.refresh(); return; }
    toast.success('Session revoked');
    await load();
  });

  const verified = factors.filter((f) => f.status === 'verified');
  const qrSrc = enroll ? (enroll.qr.startsWith('data:') ? enroll.qr : `data:image/svg+xml;utf8,${encodeURIComponent(enroll.qr)}`) : '';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="card-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-medium"><KeyRound className="size-4 text-primary" /> Two-factor authentication</h3>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${verified.length ? 'bg-approved text-approved-foreground' : 'bg-pending text-pending-foreground'}`}>{verified.length ? `On · session ${aal?.current ?? 'aal1'}` : 'Off'}</span>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {mfaRequired
            ? 'Your role approves reports, blueprints and erasure requests. Once you enrol an authenticator, the database refuses those actions from any session that did not pass the second factor.'
            : 'Optional for your role, recommended. Works with Google Authenticator, Authy or any TOTP app.'}
        </p>
        {verified.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {verified.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span>{f.friendly_name ?? 'Authenticator'} <span className="text-xs text-muted-foreground">· since {new Date(f.created_at).toLocaleDateString('en-IN')}</span></span>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => unenroll(f.id)} aria-label="Remove factor"><Trash2 className="size-4" /></Button>
              </li>
            ))}
          </ul>
        )}
        {enroll ? (
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="TOTP QR code" width={160} height={160} className="rounded-lg bg-white p-2" />
              <div className="min-w-0 flex-1 text-sm">
                <p>Scan with your authenticator app, then enter the 6-digit code.</p>
                <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">Secret: {enroll.secret}</p>
              </div>
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); verify(); }}>
              <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" pattern="[0-9]{6}" placeholder="123456" aria-label="Verification code" className="h-10 max-w-40 tabular" />
              <Button type="submit" disabled={pending || code.trim().length !== 6}>Verify</Button>
              <Button type="button" variant="ghost" onClick={() => setEnroll(null)}>Cancel</Button>
            </form>
          </div>
        ) : (
          <Button onClick={startEnroll} disabled={pending} variant={verified.length ? 'outline' : 'default'}><ShieldCheck className="size-4" /> {verified.length ? 'Add another authenticator' : 'Turn on two-factor'}</Button>
        )}
      </section>

      <section className="card-surface p-5">
        <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-medium"><MonitorSmartphone className="size-4 text-primary" /> Signed-in devices</h3>
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.user_agent?.split(') ')[0]?.replace('(', '· ') ?? 'Unknown device'} {s.id === mine && <span className="ml-1 rounded-full bg-approved px-1.5 py-0.5 text-[10px] text-approved-foreground">this device</span>}</p>
                <p className="text-xs text-muted-foreground">{s.ip ?? '—'} · {s.aal ?? 'aal1'} · active {new Date(s.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => revoke(s.id)}>{s.id === mine ? 'Sign out' : 'Revoke'}</Button>
            </li>
          ))}
          {sessions.length === 0 && <li className="text-sm text-muted-foreground">Loading sessions…</li>}
        </ul>
      </section>
    </div>
  );
}
