// `npm run doctor`: checks adb, connects to the stick and prints what it is.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { AdbDevice } from './adbDevice.ts';

const root = path.resolve(import.meta.dirname, '../..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  /* no .env */
}

const host = process.env.STICK_HOST;
const port = Number(process.env.STICK_PORT ?? 5555);
const adbPath = process.env.ADB_PATH ?? 'adb';

function ok(msg: string) {
  console.log(`  [ok]   ${msg}`);
}
function fail(msg: string): never {
  console.log(`  [fail] ${msg}`);
  process.exit(1);
}

console.log('Mi TV Stick doctor\n');

if (!host) fail('STICK_HOST is not set. Copy .env.example to .env and put the stick IP address in it.');

await new Promise<void>((resolve) => {
  execFile(adbPath, ['version'], (err, stdout) => {
    if (err) fail(`'${adbPath}' not found. Install Android platform-tools and add it to PATH (or set ADB_PATH).`);
    ok(stdout.split('\n')[0] ?? 'adb found');
    resolve();
  });
});

const device = new AdbDevice(host, port, adbPath);
try {
  const props = await device.shell(
    'getprop ro.product.manufacturer; getprop ro.product.model; getprop ro.build.version.release; getprop ro.build.version.sdk',
  );
  const [maker, model, release, sdk] = props.trim().split(/\r?\n/);
  ok(`Connected to ${device.label}`);
  console.log(`\n  Device:   ${maker} ${model}`);
  console.log(`  Android:  ${release} (API ${sdk})`);
} catch (e) {
  fail(
    `${e instanceof Error ? e.message : String(e)}\n\n` +
      '  Checklist:\n' +
      '   - Stick and laptop are on the same Wi-Fi/network\n' +
      '   - Developer options > USB debugging is ON (Android 11+: Wireless debugging, then `adb pair`)\n' +
      '   - STICK_HOST / STICK_PORT in .env match the stick\n',
  );
}

const status = await device.status();
if (status.connected) {
  console.log(`  Round trip: ${status.latencyMs} ms`);
  if (status.memory) console.log(`  Memory:     ${status.memory.usedMb}/${status.memory.totalMb} MB used (${status.memory.usedPct}%)`);
  if (status.network) console.log(`  Network:    ${JSON.stringify(status.network)}`);
  if (status.foregroundApp) console.log(`  Foreground: ${status.foregroundApp}`);
  console.log('\nAll good. Run `npm run dev`.');
}
