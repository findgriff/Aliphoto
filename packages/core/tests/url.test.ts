import { describe, expect, it } from 'vitest';

import { normalizeAndDedupeUrls, normalizeImageUrl } from '../src/url';

describe('url normalization', () => {
  it('normalizes protocol-relative and upgrades http to https', () => {
    expect(normalizeImageUrl('//cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(normalizeImageUrl('http://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });

  it('deduplicates case-insensitively', () => {
    const urls = normalizeAndDedupeUrls([
      'https://cdn.example.com/A.JPG',
      'https://cdn.example.com/a.jpg',
      '//cdn.example.com/a.jpg'
    ]);

    expect(urls).toEqual(['https://cdn.example.com/A.JPG']);
  });

  it('filters non-image urls', () => {
    const urls = normalizeAndDedupeUrls(['https://example.com/index.html']);
    expect(urls).toEqual([]);
  });
});
