import type { SupabaseClient } from '@supabase/supabase-js';
import { jsonEditDistance } from './edit-distance';

export interface ApproveArtifactInput {
  schoolId: string;
  artifactType: string;
  artifactId: string;
  generatedVersion: unknown;
  finalVersion: unknown;
  approvedBy: string;
}

export interface ApproveArtifactResult {
  approvalId: string;
  editDistance: number;
}

/**
 * Writes the `approvals` ledger row (Section 6.2). This is what
 * `enforce_approval_gate()` checks for before a status column is allowed
 * into a gated value ('approved', 'published', ...) -- call this BEFORE
 * transitioning the artifact's own status; the database rejects the reverse
 * order (Section 8 acceptance test).
 */
export async function approveArtifact(
  client: SupabaseClient,
  input: ApproveArtifactInput,
): Promise<ApproveArtifactResult> {
  const editDistance = jsonEditDistance(input.generatedVersion, input.finalVersion);

  const { data, error } = await client
    .from('approvals')
    .insert({
      school_id: input.schoolId,
      artifact_type: input.artifactType,
      artifact_id: input.artifactId,
      generated_version: input.generatedVersion,
      final_version: input.finalVersion,
      edit_distance: editDistance,
      approved_by: input.approvedBy,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`approveArtifact failed: ${error.message}`);
  }

  return { approvalId: data.id as string, editDistance };
}

/**
 * Generic status transition for any artifact table with a `status` column.
 * Callers approve first (approveArtifact), then transition -- the DB
 * trigger enforces that order for every gated status.
 */
export async function transitionArtifactStatus(
  client: SupabaseClient,
  table: string,
  id: string,
  newStatus: string,
): Promise<void> {
  const { error } = await client.from(table).update({ status: newStatus }).eq('id', id);
  if (error) {
    throw new Error(`transitionArtifactStatus failed: ${error.message}`);
  }
}
