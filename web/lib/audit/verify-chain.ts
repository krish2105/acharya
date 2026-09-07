import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Calls the Postgres `verify_chain(school_id)` function (migration 0002).
 * Returns 'OK' if the hash chain is intact, or a 'TAMPERED at id=...'
 * description of the first row where it breaks.
 */
export async function verifyChain(client: SupabaseClient, schoolId?: string): Promise<string> {
  const { data, error } = await client.rpc('verify_chain', { p_school_id: schoolId ?? null });
  if (error) {
    throw new Error(`verifyChain failed: ${error.message}`);
  }
  return data as string;
}
