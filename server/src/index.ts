import fs from 'node:fs';
import path from 'node:path';
import { AdbDevice } from './adbDevice.ts';
import { createApp } from './app.ts';
import type { Device } from './device.ts';
import { MockDevice } from './mockDevice.ts';

const root = path.resolve(import.meta.dirname, '../..');

// Optional .env at the repo root (STICK_HOST=192.168.1.50 etc.).
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  /* no .env, that's fine */
}

const env = process.env;
const port = Number(env.PORT ?? 8787);
const host = env.HOST ?? '127.0.0.1';
const useMock = env.MOCK === '1' || !env.STICK_HOST;

let device: Device;
if (useMock) {
  device = new MockDevice();
  console.log(
    env.MOCK === '1'
      ? 'Mock mode (MOCK=1): no real TV is controlled.'
      : 'Mock mode: STICK_HOST is not set, so no real TV is controlled. Copy .env.example to .env and set STICK_HOST.',
  );
} else {
  device = new AdbDevice(env.STICK_HOST as string, Number(env.STICK_PORT ?? 5555), env.ADB_PATH ?? 'adb');
  console.log(`ADB mode: controlling ${device.label}`);
}

const staticDir = path.join(root, 'web/dist');
const server = createApp({
  device,
  configDir: path.join(root, 'config'),
  ...(fs.existsSync(staticDir) ? { staticDir } : {}),
  allowedHosts: (env.ALLOWED_HOSTS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
});

server.listen(port, host, () => {
  console.log(`API on http://${host}:${port}${fs.existsSync(staticDir) ? ' (serving the built UI)' : ''}`);
  if (host !== '127.0.0.1' && host !== 'localhost') {
    console.log('Warning: listening beyond localhost. Anyone on your network can control the TV.');
  }
});
