import type { Device, DeviceStatus, InstalledApp, LaunchTarget, ProcessMemory } from './device.ts';
import type { KeyName } from './keys.ts';
import { normalizeTypedText } from './parse.ts';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_APPS = [
  'com.google.android.youtube.tv',
  'com.netflix.ninja',
  'com.amazon.amazonvideo.livingroom',
  'com.spotify.tv.android',
  'org.xbmc.kodi',
  'com.android.vending',
];

const MOCK_PROCESSES: ProcessMemory[] = [
  { name: 'org.xbmc.kodi', pid: 6404, memoryMb: 229.3, state: 'activities' },
  { name: 'com.google.android.gms', pid: 3142, memoryMb: 51 },
  { name: 'com.google.android.katniss:search', pid: 7918, memoryMb: 48.9 },
  { name: 'system', pid: 3188, memoryMb: 41.9 },
  { name: 'com.android.vending', pid: 6795, memoryMb: 26.6 },
  { name: 'com.mock.launcher', pid: 3770, memoryMb: 8.7, state: 'activities' },
];

/** A pretend stick: same behavior and validation as the real one, no hardware needed. */
export class MockDevice implements Device {
  readonly mode = 'mock' as const;
  readonly label = 'Mock device (no real TV)';
  /** Everything typed so far, handy for tests. */
  typed = '';
  foreground = 'com.mock.launcher';
  keys: KeyName[] = [];
  private delayMs: number;

  constructor(delayMs = 25) {
    this.delayMs = delayMs;
  }

  async key(name: KeyName): Promise<void> {
    await sleep(this.delayMs);
    this.keys.push(name);
    if (name === 'HOME') this.foreground = 'com.mock.launcher';
    if (name === 'DELETE') this.typed = this.typed.slice(0, -1);
  }

  async text(text: string): Promise<void> {
    const clean = normalizeTypedText(text);
    await sleep(this.delayMs);
    this.typed += clean;
  }

  async launch(target: LaunchTarget): Promise<void> {
    await sleep(this.delayMs);
    this.foreground = target.type === 'app' ? target.package : 'com.android.tv.settings';
  }

  async status(): Promise<DeviceStatus> {
    await sleep(this.delayMs);
    const totalMb = 1792;
    const wobble = Math.sin(Date.now() / 9000);
    const usedPct = Math.round(62 + wobble * 8);
    const usedMb = Math.round((totalMb * usedPct) / 100);
    return {
      connected: true,
      mode: this.mode,
      label: this.label,
      latencyMs: this.delayMs,
      memory: { totalMb, usedMb, availableMb: totalMb - usedMb, usedPct },
      network: { ssid: 'MockWiFi', ip: '192.168.1.50', rssi: -52 + Math.round(wobble * 4), linkSpeedMbps: 433, frequencyMhz: 5180 },
      foregroundApp: this.foreground,
      checkedAt: Date.now(),
    };
  }

  async listApps(): Promise<InstalledApp[]> {
    await sleep(this.delayMs);
    return MOCK_APPS.map((p) => ({ package: p }));
  }

  async listProcesses(): Promise<ProcessMemory[]> {
    await sleep(this.delayMs);
    return MOCK_PROCESSES.map((p) => ({ ...p }));
  }
}
