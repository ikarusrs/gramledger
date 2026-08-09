import { describe, expect, it } from 'vitest';

import { formatInr, formatInrCompact } from '../lib/format';

describe('formatInr', () => {
  it('formats amounts with Indian digit grouping', () => {
    expect(formatInr(12000000)).toBe('₹1,20,00,000');
  });

  it('handles zero', () => {
    expect(formatInr(0)).toBe('₹0');
  });
});

describe('formatInrCompact', () => {
  it('compacts large amounts for chart axes', () => {
    expect(formatInrCompact(12000000)).toContain('₹');
    expect(formatInrCompact(12000000)).toContain('Cr');
  });
});
