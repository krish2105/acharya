'use client';

import { useState, useTransition } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { runAlignmentEngine } from './actions';

export function RunEngineButton() {
  const [pending, start] = useTransition();
  const [useLlm, setUseLlm] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} className="accent-primary" />
        LLM band (0.65–0.82)
      </label>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const s = await runAlignmentEngine(useLlm);
              toast.success(`Engine run: ${s.embedding_suggested} embedding + ${s.llm_suggested} LLM proposals across ${s.outcomes} outcomes`);
            } catch (e) {
              toast.error((e as Error).message);
            }
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Run alignment engine
      </Button>
    </div>
  );
}
