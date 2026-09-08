import 'server-only';

const BASE = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://127.0.0.1:8000';

export class WorkerError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Server-only call to the FastAPI worker. Sends the shared token and the
 * caller's school_id (the worker rate-limits per tenant). */
export async function workerFetch<T>(
  path: string,
  opts: { schoolId: string; method?: 'GET' | 'POST'; json?: unknown; formData?: FormData },
): Promise<T> {
  const token = process.env.WORKER_TOKEN;
  if (!token) throw new WorkerError('WORKER_TOKEN is not configured', 500);

  const headers: Record<string, string> = { 'X-Worker-Token': token, 'X-School-Id': opts.schoolId };
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  } else if (opts.formData) {
    body = opts.formData;
  }

  const res = await fetch(`${BASE}${path}`, { method: opts.method ?? 'POST', headers, body, cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      detail = (JSON.parse(text) as { detail?: string }).detail ?? text;
    } catch {}
    throw new WorkerError(detail || `worker responded ${res.status}`, res.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}
