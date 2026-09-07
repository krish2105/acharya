'use server';

import { revalidatePath } from 'next/cache';
import { approveArtifact, transitionArtifactStatus } from '@/lib/approval';
import { logEvent } from '@/lib/audit';
import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function approveDemoArtifact(artifactId: string, generatedText: string, finalText: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('not authenticated');

  const supabase = await createClient();

  await approveArtifact(supabase, {
    schoolId: user.schoolId,
    artifactType: 'demo_artifact',
    artifactId,
    generatedVersion: { text: generatedText },
    finalVersion: { text: finalText },
    approvedBy: user.id,
  });

  await transitionArtifactStatus(supabase, 'demo_artifacts', artifactId, 'approved');

  // audit_events grants no insert policy to `authenticated` by design
  // (Section 6.2) -- the audit trail is always written by trusted
  // server-side code via the service role, never directly by a client role.
  const serviceClient = createServiceClient();
  await logEvent(serviceClient, {
    schoolId: user.schoolId,
    actorId: user.id,
    actorRole: user.role,
    action: 'approve',
    entityType: 'demo_artifact',
    entityId: artifactId,
  });

  revalidatePath('/dashboard');
}
