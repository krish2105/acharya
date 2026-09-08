import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DashboardStats {
  pendingApprovals: number;
  approved: number;
  generations: number;
  redactions: number;
  students: number;
  activity: { id: number; action: string; entityType: string; actorRole: string | null; at: string }[];
}

// Tile data for the bento dashboard. Each later phase widens the sources
// (items, artifacts, descriptors) without changing the tile contract.
export async function getDashboardStats(client: SupabaseClient, schoolId: string): Promise<DashboardStats> {
  const [pending, approved, gen, students, activity] = await Promise.all([
    client.from('demo_artifacts').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'draft'),
    client.from('approvals').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    client.from('generation_log').select('redaction_count').eq('school_id', schoolId),
    client.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    client
      .from('audit_events')
      .select('id, action, entity_type, actor_role, occurred_at')
      .eq('school_id', schoolId)
      .order('id', { ascending: false })
      .limit(6),
  ]);

  const genRows = (gen.data ?? []) as { redaction_count: number }[];

  return {
    pendingApprovals: pending.count ?? 0,
    approved: approved.count ?? 0,
    generations: genRows.length,
    redactions: genRows.reduce((s, r) => s + (r.redaction_count ?? 0), 0),
    students: students.count ?? 0,
    activity: ((activity.data ?? []) as { id: number; action: string; entity_type: string; actor_role: string | null; occurred_at: string }[]).map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entity_type,
      actorRole: a.actor_role,
      at: a.occurred_at,
    })),
  };
}
