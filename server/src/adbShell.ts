import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

interface Pending {
  id: number;
  command: string;
  resolve: (output: string) => void;
  reject: (err: Error) => void;
  timer?: NodeJS.Timeout;
}

/**
 * One long-lived `adb shell` that runs commands one at a time. Saves the adb process start and
 * handshake of a fresh `adb shell <cmd>` per command. Each command is followed by a sentinel line
 * so we know when it finished and what its exit status was. If the shell dies, pending commands
 * fail and the next call starts a new one.
 */
export class PersistentShell {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private queue: Pending[] = [];
  private current: Pending | null = null;
  private buffer = '';
  private nextId = 0;
  private readonly token = `__MITV_${process.pid}_`;

  private adbPath: string;
  private serial: string;
  private timeoutMs: number;

  constructor(adbPath: string, serial: string, timeoutMs = 4_000) {
    this.adbPath = adbPath;
    this.serial = serial;
    this.timeoutMs = timeoutMs;
  }

  /** Run a command and resolve with its output. Rejects on non-zero exit, timeout or a dead shell. */
  run(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, command, resolve, reject });
      this.pump();
    });
  }

  close(): void {
    this.fail(new Error('shell closed'));
    this.kill();
  }

  private start(): ChildProcessWithoutNullStreams {
    const proc = spawn(this.adbPath, ['-s', this.serial, 'shell'], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc = proc;
    this.buffer = '';
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => this.onData(chunk));
    proc.stderr.on('data', (chunk: string) => this.onData(chunk));
    // stdin errors (EPIPE) surface through 'close' too
    proc.stdin.on('error', () => {});
    proc.on('error', (err) => this.onDead(proc, err));
    proc.on('close', () => this.onDead(proc, new Error('adb shell closed')));
    return proc;
  }

  private pump(): void {
    if (this.current || this.queue.length === 0) return;
    const job = this.queue.shift() as Pending;
    this.current = job;
    const proc = this.proc ?? this.start();
    job.timer = setTimeout(() => {
      this.fail(new Error(`adb shell timed out: ${job.command}`));
      this.kill();
    }, this.timeoutMs);
    proc.stdin.write(`${job.command}; echo ${this.token}${job.id}_$?\n`);
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    const job = this.current;
    if (!job) {
      this.buffer = '';
      return;
    }
    const m = new RegExp(`${this.token}${job.id}_(\\d+)\\r?\\n`).exec(this.buffer);
    if (!m) return;
    const output = this.buffer.slice(0, m.index);
    this.buffer = this.buffer.slice(m.index + m[0].length);
    clearTimeout(job.timer);
    this.current = null;
    if (m[1] === '0') job.resolve(output);
    else job.reject(new Error(output.trim() || `command exited with status ${m[1]}`));
    this.pump();
  }

  private onDead(proc: ChildProcessWithoutNullStreams, err: Error): void {
    if (this.proc !== proc) return;
    this.proc = null;
    this.fail(err);
  }

  private fail(err: Error): void {
    const jobs = [...(this.current ? [this.current] : []), ...this.queue];
    this.current = null;
    this.queue = [];
    for (const job of jobs) {
      clearTimeout(job.timer);
      job.reject(err);
    }
  }

  private kill(): void {
    const proc = this.proc;
    this.proc = null;
    proc?.kill();
  }
}
