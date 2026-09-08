import { createServiceClient } from '@/lib/supabase/service';
import { ParentTokenForm } from './form';

/** Tokenised parent input (no login). The token is single-use, time-limited,
 * bound to one guardian and one child. Nothing about the child beyond first
 * name is shown. */
export default async function ParentInputPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const svc = createServiceClient();
  const { data: t } = await svc.from('hpc_input_tokens').select('token, term, expires_at, used_at, students(full_name), guardians(full_name), schools(name)').eq('token', token).maybeSingle();
  const valid = !!t && !t.used_at && new Date(t.expires_at) > new Date();
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center p-6">
      <div className="card-surface p-6">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><span className="font-display font-semibold">A</span></span>
        {!valid ? (
          <p className="mt-4 text-sm text-muted-foreground">This link has expired or was already used. Please ask the class teacher for a new one. · यह लिंक समाप्त हो गया है या पहले उपयोग हो चुका है।</p>
        ) : (
          <ParentTokenForm token={token} childFirstName={(t!.students as unknown as { full_name: string }).full_name.split(' ')[0]} guardian={(t!.guardians as unknown as { full_name: string }).full_name} school={(t!.schools as unknown as { name: string }).name} term={t!.term} />
        )}
      </div>
    </main>
  );
}
