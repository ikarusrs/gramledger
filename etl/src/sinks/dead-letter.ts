import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { DeadLetterSink, ETLRecord, StageName } from '../core/types.js';

export interface FileDeadLetterSinkOptions {
  /** Directory for dead-letter files (created if missing). */
  dir: string;
}

/**
 * Writes dead-lettered records as one JSONL file per write call:
 * `<source>-<stage>-<ISO timestamp>.jsonl`. Each line:
 * `{ ts, reason, record }`.
 */
export class FileDeadLetterSink implements DeadLetterSink {
  constructor(private readonly options: FileDeadLetterSinkOptions) {}

  private seq = 0;

  async write(
    source: string,
    stage: StageName,
    reason: string,
    records: ETLRecord[],
  ): Promise<void> {
    if (records.length === 0) return;
    await mkdir(this.options.dir, { recursive: true });
    this.seq++;
    const ts = new Date();
    const file = path.join(
      this.options.dir,
      `${source}-${stage}-${ts.toISOString().replace(/[:.]/g, '-')}-${this.seq}.jsonl`,
    );
    const lines = records.map((record) =>
      JSON.stringify({ ts: ts.toISOString(), source, stage, reason, record }),
    );
    await appendFile(file, `${lines.join('\n')}\n`, 'utf8');
  }
}

/** No-op sink used when a source does not configure dead-letter handling. */
export const NullDeadLetterSink = (): DeadLetterSink => ({
  async write(): Promise<void> {},
});
