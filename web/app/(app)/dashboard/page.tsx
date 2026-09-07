import { getCurrentUser } from '@/lib/supabase/current-user';
import { createClient } from '@/lib/supabase/server';
import { ApproveButton } from './approve-button';

// Phase 0 has no real SETU learning_outcomes table yet (Phase 1 adds it) --
// this is the same hardcoded demo outcome the seeded artifact is framed
// around, purely to show what the outcome chip looks like wired up.
const DEMO_OUTCOME = {
  frameworkCode: 'CBSE',
  refCode: 'CBSE.SCI.10.4.2',
  statement: 'Explain the process of photosynthesis in green plants and its significance.',
};

const DEMO_FINAL_TEXT =
  'Photosynthesis converts light energy into chemical energy, stored as glucose, which plants use to grow.';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: artifact } = await supabase
    .from('demo_artifacts')
    .select('id, title, generated_version, status')
    .eq('school_id', user!.schoolId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Welcome, {user?.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {user?.schoolName} · signed in as {user?.role}
        </p>
      </div>

      {artifact ? (
        <ApproveButton
          artifactId={artifact.id}
          title={artifact.title}
          outcome={DEMO_OUTCOME}
          generatedText={(artifact.generated_version as { text: string }).text}
          finalText={DEMO_FINAL_TEXT}
          approved={artifact.status === 'approved'}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No demo artifact seeded for this school.</p>
      )}
    </div>
  );
}
