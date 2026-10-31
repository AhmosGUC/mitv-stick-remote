export type KeyName =
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'OK' | 'ENTER' | 'BACK' | 'HOME' | 'MENU' | 'SEARCH' | 'DELETE'
  | 'VOL_UP' | 'VOL_DOWN' | 'MUTE' | 'POWER' | 'SLEEP' | 'WAKEUP'
  | 'PLAY_PAUSE' | 'REWIND' | 'FAST_FORWARD';

export type KeyboardMode = 'off' | 'navigate' | 'type';

export interface Info {
  mode: 'adb' | 'mock';
  label: string;
}

export interface DeviceStatus {
  connected: boolean;
  mode: 'adb' | 'mock';
  label: string;
  latencyMs: number | null;
  memory: { totalMb: number; availableMb: number; usedMb: number; usedPct: number } | null;
  network: { ssid?: string; ip?: string; rssi?: number; linkSpeedMbps?: number; frequencyMhz?: number } | null;
  foregroundApp?: string;
  error?: string;
  checkedAt: number;
}

export type ShortcutAction =
  | { type: 'app'; package: string }
  | { type: 'intent'; action: string; data?: string }
  | { type: 'keys'; keys: KeyName[] }
  | { type: 'text'; text: string };

export interface Shortcut {
  id: string;
  label: string;
  group: string;
  action: ShortcutAction;
  custom?: boolean;
}

export interface InstalledApp {
  package: string;
}

export interface ProcessMemory {
  name: string;
  pid: number;
  memoryMb: number;
  state?: string;
}

export interface LogEntry {
  id: number;
  ts: number;
  kind: string;
  detail: string;
  ok: boolean;
  ms: number;
  error?: string;
}
