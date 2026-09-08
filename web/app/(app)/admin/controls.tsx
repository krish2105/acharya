'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, Mail, Map, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { flushNotifications, resetDemo } from './actions';

export function AdminControls() {
  const [pending, start] = useTransition();
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <section className="card-surface flex flex-col gap-3 p-5">
        <h3 className="flex items-center gap-2 font-display text-lg font-medium"><RotateCcw className="size-4 text-primary" /> Reset demo</h3>
        <p className="text-sm text-muted-foreground">Restores the Kalanjali tenant to its seeded snapshot: every module table, every approval. Audit rows are append-only and stay. Target: under 45 seconds.</p>
        <Button disabled={pending} onClick={() => { if (window.confirm('Reset the demo tenant to its snapshot?')) start(async () => { try { const r = await resetDemo(); setLast(`Reset ${r.tables} tables in ${(r.ms / 1000).toFixed(1)} s`); toast.success('Demo reset'); } catch (e) { toast.error((e as Error).message); } }); }}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Reset now
        </Button>
        {last && <p className="text-xs text-approved-foreground">{last}</p>}
      </section>
      <section className="card-surface flex flex-col gap-3 p-5">
        <h3 className="flex items-center gap-2 font-display text-lg font-medium"><Map className="size-4 text-primary" /> Guided tour</h3>
        <p className="text-sm text-muted-foreground">Seven stops from the dashboard to the approval queue. Runs for whoever is signed in; teachers get it from ⌘K too.</p>
        <Button variant="outline" render={<Link href="/dashboard?tour=1" />} nativeButton={false}>Start tour</Button>
      </section>
      <section className="card-surface flex flex-col gap-3 p-5">
        <h3 className="flex items-center gap-2 font-display text-lg font-medium"><Mail className="size-4 text-primary" /> Email digests</h3>
        <p className="text-sm text-muted-foreground">pg_cron enqueues HOD digests daily and descriptor reminders on Mondays. Run both now and flush the queue (Mailpit locally, Resend in production).</p>
        <Button variant="outline" disabled={pending} onClick={() => start(async () => { try { const r = await flushNotifications(); toast.success(`Queued ${r.hod_digests + r.descriptor_reminders}, sent ${r.sent} via ${r.transport}${r.failed ? `, ${r.failed} failed` : ''}`); } catch (e) { toast.error((e as Error).message); } })}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Enqueue & send
        </Button>
      </section>
    </div>
  );
}
