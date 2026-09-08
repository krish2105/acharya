'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Counter, EASE_OUT_EXPO, Magnetic, Marquee, SplitWords } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/provider';
import { createClient } from '@/lib/supabase/client';

const DEMO_ACCOUNTS = [
  { label: 'Teacher', email: 'teacher@kalanjali.demo' },
  { label: 'Academic head', email: 'academic@kalanjali.demo' },
  { label: 'HOD', email: 'hod@kalanjali.demo' },
  { label: 'Principal', email: 'principal@kalanjali.demo' },
  { label: 'Parent', email: 'parent@kalanjali.demo' },
  { label: 'Student', email: 'student@kalanjali.demo' },
  { label: 'Super admin', email: 'super@acharya.demo' },
];

const CHIPS = ['CBSE / SCI.10.4.2', 'IB_DP / BIO.2.1', 'IGCSE / 0610.6.2', 'AP / BIO.3.4', 'CBSE / MATH.9.2.1', 'CAMB_LOWER_SEC / 7Bp.03', 'IB_MYP / SCI.C.iii', 'CBSE / SST.8.3.1'];

export default function LoginPage() {
  const router = useRouter();
  const { t } = useT();
  const reduced = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mfa, setMfa] = useState<{ factorId: string } | null>(null);
  const [code, setCode] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError('Email or password is incorrect. Try a demo account below.');
      return;
    }
    // Accounts that enrolled an authenticator must pass it before the app
    // (and the database's aal2 policies) treat the session as signed in.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      const { data: f } = await supabase.auth.mfa.listFactors();
      const factor = f?.totp?.[0];
      if (factor) {
        setMfa({ factorId: factor.id });
        setLoading(false);
        return;
      }
    }
    router.push('/');
    router.refresh();
  };

  const verifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfa) return;
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: mfa.factorId, code: code.trim() });
    setLoading(false);
    if (error) {
      setError('That code did not work. Codes rotate every 30 seconds — try the current one.');
      return;
    }
    router.push('/');
    router.refresh();
  };

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <section className="gradient-mesh relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 0.6px, transparent 0.6px)', backgroundSize: '22px 22px' }} />
        <Link href="/" className="relative inline-flex items-center gap-2 text-sm text-white/80 hover:text-white">
          <ArrowLeft className="size-4" /> Back
        </Link>

        <div className="relative max-w-xl">
          <SplitWords text="Aligned drafts, never decisions." className="font-display text-display-xl font-medium" />
          <motion.p
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8, ease: EASE_OUT_EXPO }}
            className="mt-6 max-w-md text-lg leading-relaxed text-white/80"
          >
            Every AI output ties to a learning outcome, is schema-checked, and waits for a teacher before it reaches a child.
          </motion.p>

          <motion.dl
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-10 grid grid-cols-3 gap-6"
          >
            {[
              { v: 4, l: 'boards, one spine' },
              { v: 0, l: 'PII spans to any model' },
              { v: 100, l: '% human-approved', suffix: '' },
            ].map((s) => (
              <div key={s.l}>
                <dt className="font-display text-4xl font-medium">
                  <Counter value={s.v} />
                </dt>
                <dd className="mt-1 text-sm text-white/70">{s.l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <div className="relative -mx-10">
          <Marquee duration={36}>
            {CHIPS.map((c) => (
              <span key={c} className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 font-mono text-xs text-white/90">
                {c}
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      <section className="flex items-center justify-center bg-background p-6">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
          className="card-surface w-full max-w-md p-8"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
            <span className="font-display text-lg font-semibold">A</span>
          </span>
          <h1 className="mt-5 font-display text-2xl font-medium tracking-tight">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('login.title')}</p>

          {mfa ? (
            <form onSubmit={verifyMfa} className="mt-6 flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="totp">Authenticator code</Label>
                <Input id="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="tabular text-lg tracking-[0.3em]" autoFocus />
                <p className="text-xs text-muted-foreground">Two-factor authentication is on for this account.</p>
              </div>
              {error && (
                <p role="alert" className="rounded-lg bg-rejected px-3 py-2 text-sm text-rejected-foreground">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full shadow-glow" disabled={loading || code.trim().length !== 6}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null} Verify and continue
              </Button>
              <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={async () => { await createClient().auth.signOut(); setMfa(null); setCode(''); }}>Use a different account</button>
            </form>
          ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t('login.password')}</Label>
              <div className="relative">
                <Input id="password" type={show ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-rejected px-3 py-2 text-sm text-rejected-foreground">
                {error}
              </p>
            )}

            <Magnetic strength={0.12}>
              <Button type="submit" size="lg" className="w-full shadow-glow" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {loading ? t('login.submitting') : t('login.submit')}
              </Button>
            </Magnetic>
          </form>
          )}

          <div className="mt-6 border-t pt-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('login.demo')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword('Demo@2026');
                  }}
                  className="rounded-full border px-3 py-1 text-xs hover:border-primary/40 hover:bg-primary-soft"
                >
                  {a.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Fictional demo tenant. Password Demo@2026 (local only).</p>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
