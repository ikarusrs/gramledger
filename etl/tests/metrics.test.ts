import { describe, expect, it } from 'vitest';
import { InMemoryMetrics } from '../src/core/metrics.js';

describe('InMemoryMetrics', () => {
  it('tracks dotted counters and sums increments', () => {
    const m = new InMemoryMetrics();
    m.increment('rows.failed', 2);
    m.increment('rows.failed');
    m.increment('retry.count');
    expect(m.get('rows.failed')).toBe(3);
    expect(m.get('retry.count')).toBe(1);
    expect(m.snapshot()).toMatchObject({ 'rows.failed': 3, 'retry.count': 1 });
  });

  it('defaults unknown counters to zero', () => {
    expect(new InMemoryMetrics().get('rows.skipped')).toBe(0);
  });

  it('records stage outcomes and cumulative duration', () => {
    const m = new InMemoryMetrics();
    m.increment('stages.load.ok', 2);
    m.increment('stages.load.error');
    m.set('stages.load.duration_ms', 15);
    expect(m.snapshot()).toMatchObject({
      'stages.load.ok': 2,
      'stages.load.error': 1,
      'stages.load.duration_ms': 15,
    });
  });
});
