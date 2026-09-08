import { NextResponse, type NextRequest } from 'next/server';
import { can } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/supabase/current-user';

export const runtime = 'nodejs';

/** Proxies the worker's SSE generation stream to the browser, adding auth and
 * the tenant context. The worker token never reaches the client. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!can(user, 'create', 'saarthi', { teacherId: user.id, subjectId: user.subjectId, frameworkId: user.frameworkId })) {
    return NextResponse.json({ error: 'not allowed' }, { status: 403 });
  }
  const body = await req.json();
  const upstream = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://127.0.0.1:8000'}/saarthi/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Worker-Token': process.env.WORKER_TOKEN ?? '', 'X-School-Id': user.schoolId },
    body: JSON.stringify({ ...body, school_id: user.schoolId, actor_id: user.id }),
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: await upstream.text() }, { status: upstream.status || 502 });
  }
  return new Response(upstream.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
}
