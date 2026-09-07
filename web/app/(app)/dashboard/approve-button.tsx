'use client';

import { useRouter } from 'next/navigation';
import { ApprovalCard } from '@/components/shared/approval-card';
import type { Outcome } from '@/components/shared/outcome-chip';
import { approveDemoArtifact } from './actions';

export function ApproveButton(props: {
  artifactId: string;
  title: string;
  outcome: Outcome;
  generatedText: string;
  finalText: string;
  approved: boolean;
}) {
  const router = useRouter();

  return (
    <ApprovalCard
      title={props.title}
      outcome={props.outcome}
      generatedText={props.generatedText}
      finalText={props.finalText}
      approved={props.approved}
      onApprove={async () => {
        await approveDemoArtifact(props.artifactId, props.generatedText, props.finalText);
        router.refresh();
      }}
    />
  );
}
