import { describe, expect, it } from 'vitest';

import { titleToLabel } from '../src/label';

describe('title to label', () => {
  it('normalizes title text into a valid label', () => {
    expect(titleToLabel('12" LED Desk Lamp - White/Black')).toBe('12_led_desk_lamp_white_black');
  });

  it('truncates long labels to max length', () => {
    const label = titleToLabel('x'.repeat(120));
    expect(label.length).toBe(64);
  });

  it('rejects titles that produce empty labels', () => {
    expect(() => titleToLabel('***')).toThrow(/Unable to generate label/);
  });
});
