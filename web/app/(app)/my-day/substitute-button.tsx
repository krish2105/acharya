'use client';

import { useTransition } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/provider';
import { buildSubstitutePack } from './actions';

export function SubstituteButton({ weekday }: { weekday: number }) {
  const [pending, start] = useTransition();
  const { t } = useT();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => start(async () => {
        try {
          const url = await buildSubstitutePack(weekday);
          window.open(url, '_blank', 'noopener');
        } catch (e) {
          toast.error((e as Error).message);
        }
      })}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} {t('myday.substitute')}
    </Button>
  );
}
