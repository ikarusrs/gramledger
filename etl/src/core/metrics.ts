import type { Metrics } from './types.js';

/**
 * In-memory metrics for a single run. Keys are dotted names documented by the
 * pipeline (`pipeline.duration_ms`, `retry.count`, `rows.seen`, ...).
 * Historical metrics (successful/failed imports) live in `ingestion_runs`
 * via the audit sink, not in this collector.
 */
export class InMemoryMetrics implements Metrics {
  private readonly values = new Map<string, number>();

  increment(name: string, by = 1): void {
    this.values.set(name, (this.values.get(name) ?? 0) + by);
  }

  set(name: string, value: number): void {
    this.values.set(name, value);
  }

  get(name: string): number {
    return this.values.get(name) ?? 0;
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.values);
  }
}
