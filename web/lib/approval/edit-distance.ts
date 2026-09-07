/**
 * Character-level Levenshtein distance between the generated and
 * teacher-edited versions of an artifact (Section 6.2 `approvals.edit_distance`,
 * rule 17: show the teacher what changed). Operates on the JSON string form
 * of each version -- simple, deterministic, and enough to flag how much a
 * draft was edited without needing a structural diff.
 */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

export function jsonEditDistance(generated: unknown, final: unknown): number {
  return editDistance(JSON.stringify(generated), JSON.stringify(final));
}
