'use client';

import { useTransition } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { runCalibration } from '../actions';

export function RunCalibrationButton() {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => { try { const r = await runCalibration(); toast.success(`${r.items} items calibrated`); } catch (e) { toast.error((e as Error).message); } })}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Run now
    </Button>
  );
}
