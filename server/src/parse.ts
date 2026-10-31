import { UserError } from './device.ts';
import type { Memory, NetworkInfo } from './device.ts';

/** Android package names, e.g. com.netflix.ninja */
export const PACKAGE_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
/** Intent actions, e.g. android.settings.WIFI_SETTINGS */
export const ACTION_RE = /^[A-Za-z0-9_.]+$/;

/** Quote a string for the device's POSIX shell. */
export function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * `input text` only handles printable ASCII. Newlines become spaces (use the
 * ENTER key to submit). Returns the cleaned text or throws a UserError.
 */
export function normalizeTypedText(text: string): string {
  const t = text.replace(/[\r\n]+/g, ' ');
  if (t.length === 0) throw new UserError('Nothing to type.', 400);
  if (t.length > 500) throw new UserError('Text is too long (max 500 characters per send).', 413);
  if (/[^\x20-\x7e]/.test(t)) {
    throw new UserError(
      'Only printable ASCII can be typed over ADB right now (Arabic and other scripts are not supported yet).',
      422,
    );
  }
  return t;
}

/** Device-shell command that types `text` into the focused field. */
export function buildInputTextCommand(text: string): string {
  // `input text` turns %s into a space.
  return `input text ${shq(normalizeTypedText(text).replace(/ /g, '%s'))}`;
}

export function parseMeminfo(text: string): Memory | null {
  const get = (key: string): number | undefined => {
    const m = new RegExp(`^${key}:\\s+(\\d+)`, 'm').exec(text);
    return m?.[1] ? Number(m[1]) : undefined;
  };
  const total = get('MemTotal');
  const avail = get('MemAvailable') ?? get('MemFree');
  if (!total || avail === undefined) return null;
  const totalMb = Math.round(total / 1024);
  const availableMb = Math.round(avail / 1024);
  return {
    totalMb,
    availableMb,
    usedMb: totalMb - availableMb,
    usedPct: Math.round(((total - avail) / total) * 100),
  };
}

/** Parses the `mWifiInfo ...` line from `dumpsys wifi`. Formats vary by Android version, so be tolerant. */
export function parseWifiInfo(text: string): NetworkInfo {
  const out: NetworkInfo = {};
  const ssid = /(?<![A-Za-z])SSID: ("([^"]*)"|[^,]*)/.exec(text);
  if (ssid) {
    const v = (ssid[2] ?? ssid[1] ?? '').trim();
    if (v && v !== '<unknown ssid>') out.ssid = v;
  }
  const rssi = /RSSI: (-?\d+)/.exec(text);
  if (rssi?.[1]) out.rssi = Number(rssi[1]);
  const speed = /Link speed: (\d+)/.exec(text);
  if (speed?.[1]) out.linkSpeedMbps = Number(speed[1]);
  const freq = /Frequency: (\d+)/.exec(text);
  if (freq?.[1]) out.frequencyMhz = Number(freq[1]);
  return out;
}

/** From `ip -o -4 addr show wlan0`. */
export function parseIp(text: string): string | undefined {
  return /inet (\d{1,3}(?:\.\d{1,3}){3})/.exec(text)?.[1];
}

/** Package name from a `mCurrentFocus=Window{... u0 pkg/Activity}` or `mFocusedApp=...` line. */
export function parseFocus(text: string): string | undefined {
  return /\bu\d+ ([A-Za-z][\w]*(?:\.[\w]+)+)\//.exec(text)?.[1];
}

/** From `pm list packages`: lines like `package:com.example.app`. */
export function parsePackages(text: string): string[] {
  const set = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^package:(\S+)$/.exec(line.trim());
    if (m?.[1]) set.add(m[1]);
  }
  return [...set].sort();
}

/** Separator the status command prints between its four sections. */
export const SECTION = '---';

export function parseStatusOutput(out: string) {
  const [mem = '', wifi = '', ip = '', focus = ''] = out.split(/^---\s*$/m);
  const network: NetworkInfo = parseWifiInfo(wifi);
  const ipAddr = parseIp(ip);
  if (ipAddr) network.ip = ipAddr;
  return {
    memory: parseMeminfo(mem),
    network: Object.keys(network).length > 0 ? network : null,
    foregroundApp: parseFocus(focus),
  };
}

/** Find the remote's input device in `getevent -p` output (e.g. "Xiaomi RC" -> /dev/input/event3). */
export function parseRemoteInputDevice(out: string): string | null {
  const re = /add device \d+: (\/dev\/input\/event\d+)\s+name:\s+"([^"]*)"/g;
  for (const m of out.matchAll(re)) {
    const [, device = '', name = ''] = m;
    if (/\b(rc|remote)\b/i.test(name)) return device;
  }
  return null;
}

/** Size of a Linux `struct input_event`: 16 bytes for 32-bit userspace, 24 for 64-bit. */
export function inputEventSize(abi: string): number {
  return /64/.test(abi) ? 24 : 16;
}

/**
 * Shell line that presses and releases a Linux input key by writing raw `input_event` records to
 * the event device. `printf` is a shell builtin, so unlike `sendevent` (one process per event)
 * nothing is spawned on the stick. The timestamp is left zero; the kernel ignores it on write.
 */
export function buildKeyWrite(device: string, code: number, eventSize = 16): string {
  const oct = (n: number) => `\\${n.toString(8).padStart(3, '0')}`;
  const record = (type: number, c: number, value: number) =>
    oct(0).repeat(eventSize - 8) +
    oct(type & 255) + oct(type >> 8) +
    oct(c & 255) + oct(c >> 8) +
    oct(value & 255) + oct(0) + oct(0) + oct(0);
  const bytes = record(1, code, 1) + record(0, 0, 0) + record(1, code, 0) + record(0, 0, 0);
  return `printf '${bytes}' > ${device}`;
}
