export interface LogEntry {
  id: number;
  ts: number;
  kind: string;
  detail: string;
  ok: boolean;
  ms: number;
  error?: string;
}

/** In-memory ring buffer of recent actions, shown in the UI to make debugging easy. */
export class ActionLog {
  private entries: LogEntry[] = [];
  private nextId = 1;
  private max: number;

  constructor(max = 200) {
    this.max = max;
  }

  add(entry: Omit<LogEntry, 'id' | 'ts'>): void {
    this.entries.push({ id: this.nextId++, ts: Date.now(), ...entry });
    if (this.entries.length > this.max) this.entries.splice(0, this.entries.length - this.max);
  }

  /** Newest first. */
  list(): LogEntry[] {
    return [...this.entries].reverse();
  }
}
