import type { KeyName } from './keys.ts';

/** An error whose message is safe and useful to show to the user. */
export class UserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'UserError';
    this.status = status;
  }
}

export type DeviceMode = 'adb' | 'mock';

export interface Memory {
  totalMb: number;
  availableMb: number;
  usedMb: number;
  usedPct: number;
}

export interface NetworkInfo {
  ssid?: string;
  ip?: string;
  rssi?: number;
  linkSpeedMbps?: number;
  frequencyMhz?: number;
}

export interface DeviceStatus {
  connected: boolean;
  mode: DeviceMode;
  label: string;
  /** Round-trip time of the status command, in ms. */
  latencyMs: number | null;
  memory: Memory | null;
  network: NetworkInfo | null;
  foregroundApp?: string;
  error?: string;
  checkedAt: number;
}

export type LaunchTarget =
  | { type: 'app'; package: string }
  | { type: 'intent'; action: string; data?: string };

export interface InstalledApp {
  package: string;
}

/** Everything the rest of the app needs from a TV stick. ADB and mock both implement it. */
export interface Device {
  readonly mode: DeviceMode;
  readonly label: string;
  key(name: KeyName): Promise<void>;
  text(text: string): Promise<void>;
  launch(target: LaunchTarget): Promise<void>;
  status(): Promise<DeviceStatus>;
  listApps(): Promise<InstalledApp[]>;
}
