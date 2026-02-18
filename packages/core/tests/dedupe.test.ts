import { describe, expect, it } from 'vitest';

import { mergeSourceUrlsBySha } from '../src/manifest';

describe('sha dedup merge', () => {
  it('merges multiple urls into sourceUrls for same sha', () => {
    const merged = mergeSourceUrlsBySha([
      { sha256: 'abc', sourceUrl: 'https://img.example.com/1.jpg' },
      { sha256: 'abc', sourceUrl: 'https://img.example.com/2.jpg' },
      { sha256: 'abc', sourceUrl: 'https://img.example.com/1.jpg' },
      { sha256: 'def', sourceUrl: 'https://img.example.com/3.jpg' }
    ]);

    expect(merged.get('abc')).toEqual([
      'https://img.example.com/1.jpg',
      'https://img.example.com/2.jpg'
    ]);
    expect(merged.get('def')).toEqual(['https://img.example.com/3.jpg']);
  });
});
