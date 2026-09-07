import { describe, expect, it } from 'vitest';
import { editDistance, jsonEditDistance } from '@/lib/approval';

describe('editDistance', () => {
  it('is 0 for identical strings', () => {
    expect(editDistance('hello', 'hello')).toBe(0);
  });

  it('counts a single substitution', () => {
    expect(editDistance('cat', 'bat')).toBe(1);
  });

  it('counts insertions', () => {
    expect(editDistance('cat', 'cats')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
  });
});

describe('jsonEditDistance', () => {
  it('is 0 when a draft is approved unedited', () => {
    const draft = { text: 'Photosynthesis converts light to energy.' };
    expect(jsonEditDistance(draft, draft)).toBe(0);
  });

  it('is > 0 when the teacher edits the draft', () => {
    const generated = { text: 'Photosynthesis converts light to energy.' };
    const final = { text: 'Photosynthesis converts sunlight into chemical energy.' };
    expect(jsonEditDistance(generated, final)).toBeGreaterThan(0);
  });
});
