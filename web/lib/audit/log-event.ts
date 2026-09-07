import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '@/lib/rbac';

export interface AuditEventInput {
  schoolId: string;
  actorId?: string | null;
  actorRole?: Role | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * Writes one row to the insert-only, hash-chained `audit_events` table.
 * `hash`/`prev_hash` are computed server-side by the `audit_events_before_insert`
 * trigger (migration 0002) -- this function never sets them.
 *
 * Requires a service-role client: `audit_events` grants no insert policy to
 * `authenticated`/`anon`, by design (Section 6.2).
 */
export async function logEvent(client: SupabaseClient, event: AuditEventInput): Promise<void> {
  const { error } = await client.from('audit_events').insert({
    school_id: event.schoolId,
    actor_id: event.actorId ?? null,
    actor_role: event.actorRole ?? null,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    payload: event.payload ?? {},
  });

  if (error) {
    throw new Error(`logEvent failed: ${error.message}`);
  }
}
