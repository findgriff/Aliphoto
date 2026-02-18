import { describe, expect, it } from 'vitest';

import { sanitizeProductLabel, validateProductLabel } from '../src/validation';

describe('product label validation', () => {
  it('accepts valid labels', () => {
    expect(validateProductLabel('example_001')).toBe('example_001');
    expect(sanitizeProductLabel('sample-ABC_9')).toBe('sample-ABC_9');
  });

  it('rejects invalid characters', () => {
    expect(() => validateProductLabel('example.001')).toThrow(/only letters/i);
    expect(() => validateProductLabel('bad space')).toThrow(/only letters/i);
  });

  it('rejects path traversal attempts', () => {
    expect(() => sanitizeProductLabel('../etc/passwd')).toThrow();
    expect(() => sanitizeProductLabel('..')).toThrow();
    expect(() => sanitizeProductLabel('abc/def')).toThrow();
  });
});
