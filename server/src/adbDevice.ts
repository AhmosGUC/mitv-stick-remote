import { execFile } from 'node:child_process';
import { UserError } from './device.ts';
import type { Device, DeviceStatus, InstalledApp, LaunchTarget } from './device.ts';
import { PersistentShell } from './adbShell.ts';
import { EVDEV_KEYS, KEYS } from './keys.ts';
import type { KeyName } from './keys.ts';
import {
  ACTION_RE,
  PACKAGE_RE,
  buildInputTextCommand,
  buildKeyWrite,
  inputEventSize,
  parsePackages,
  parseRemoteInputDevice,
  parseStatusOutput,
  shq,
} from './parse.ts';

const ADB_MISSING = 500;

function run(file: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        if ((err as { code?: unknown }).code === 'ENOENT') {
          reject(
            new UserError(
              `'${file}' was not found. Install Android platform-tools (adb) and make sure it is on your PATH, or set ADB_PATH.`,
              ADB_MISSING,
            ),
          );
          return;
        }
        let msg = String(stderr || stdout || err.message).trim() || 'adb failed';
        if (/unauthorized/i.test(msg)) {
          msg += ' — accept the "Allow USB debugging?" prompt on the TV (tick "Always allow").';
        }
        reject(new UserError(msg, 502));
        return;
      }
      resolve(String(stdout));
    });
  });
}

const STATUS_COMMAND = [
  "grep -E '^(MemTotal|MemAvailable|MemFree):' /proc/meminfo",
  'echo ---',
  'dumpsys wifi | grep -m1 mWifiInfo',
  'echo ---',
  'ip -o -4 addr show wlan0',
  'echo ---',
  "dumpsys window | grep -m1 -E 'mCurrentFocus|mFocusedApp'",
].join('; ');

/** Controls a Mi TV Stick over network ADB by shelling out to the `adb` binary. */
export class AdbDevice implements Device {
  readonly mode = 'adb' as const;
  readonly label: string;
  private serial: string;
  private adbPath: string;
  private keyShell: PersistentShell;
  private inputDevice: { path: string; eventSize: number } | null | undefined;

  constructor(host: string, port = 5555, adbPath = 'adb') {
    this.serial = `${host}:${port}`;
    this.label = this.serial;
    this.adbPath = adbPath;
    this.keyShell = new PersistentShell(adbPath, this.serial);
  }

  private async connect(): Promise<void> {
    const out = await run(this.adbPath, ['connect', this.serial], 10_000);
    if (!/connected to|already connected/i.test(out)) {
      throw new UserError(`Could not connect to ${this.serial}: ${out.trim() || 'no response'}`, 502);
    }
  }

  /** Run a shell command on the stick. Reconnects and retries once if the first attempt fails. */
  async shell(command: string, timeout = 8_000): Promise<string> {
    const args = ['-s', this.serial, 'shell', command];
    try {
      return await run(this.adbPath, args, timeout);
    } catch (e) {
      if (e instanceof UserError && e.status === ADB_MISSING) throw e;
      await this.connect();
      return await run(this.adbPath, args, timeout);
    }
  }

  /** The remote's /dev/input node, found once; null if there isn't one (keys then use `input keyevent`). */
  private async remoteInputDevice() {
    if (this.inputDevice === undefined) {
      const path = parseRemoteInputDevice(await this.shell('getevent -p'));
      const eventSize = inputEventSize(await this.shell('getprop ro.product.cpu.abi'));
      this.inputDevice = path ? { path, eventSize } : null;
    }
    return this.inputDevice;
  }

  async key(name: KeyName): Promise<void> {
    const code = EVDEV_KEYS[name];
    if (code !== undefined) {
      try {
        const device = await this.remoteInputDevice();
        if (device) {
          await this.keyShell.run(buildKeyWrite(device.path, code, device.eventSize));
          return;
        }
      } catch {
        // fall through to the slower, always-available path (it also reconnects if needed)
      }
    }
    await this.shell(`input keyevent ${KEYS[name]}`);
  }

  async text(text: string): Promise<void> {
    await this.shell(buildInputTextCommand(text));
  }

  async launch(target: LaunchTarget): Promise<void> {
    if (target.type === 'app') {
      if (!PACKAGE_RE.test(target.package)) throw new UserError(`Invalid package name: ${target.package}`);
      const monkey = (category: string) =>
        this.shell(`monkey -p ${target.package} -c android.intent.category.${category} 1`);
      let out = await monkey('LEANBACK_LAUNCHER');
      if (/No activities found|monkey aborted/i.test(out)) out = await monkey('LAUNCHER');
      if (/No activities found|monkey aborted/i.test(out)) {
        throw new UserError(`${target.package} is not installed or has no launcher activity.`, 404);
      }
      return;
    }
    if (!ACTION_RE.test(target.action)) throw new UserError(`Invalid intent action: ${target.action}`);
    const data = target.data ? ` -d ${shq(target.data)}` : '';
    const out = await this.shell(`am start -a ${target.action}${data}`);
    if (/Error|unable to resolve/i.test(out)) {
      throw new UserError(`The stick cannot open ${target.action}: ${out.trim().split('\n')[0]}`, 404);
    }
  }

  async status(): Promise<DeviceStatus> {
    const base = { mode: this.mode, label: this.label, checkedAt: Date.now() };
    const t0 = Date.now();
    try {
      const out = await this.shell(STATUS_COMMAND, 12_000);
      return { ...base, connected: true, latencyMs: Date.now() - t0, ...parseStatusOutput(out) };
    } catch (e) {
      return {
        ...base,
        connected: false,
        latencyMs: null,
        memory: null,
        network: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async listApps(): Promise<InstalledApp[]> {
    const out = await this.shell('pm list packages -3');
    return parsePackages(out).map((p) => ({ package: p }));
  }
}
