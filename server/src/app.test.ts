import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.ts';
import { MockDevice } from './mockDevice.ts';
import { isAllowedHost } from './http.ts';

let server: http.Server;
let base = '';
let dir = '';
const device = new MockDevice(0);

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mitv-test-'));
  await fs.copyFile(path.resolve(import.meta.dirname, '../../config/shortcuts.json'), path.join(dir, 'shortcuts.json'));
  server = createApp({ device, configDir: dir });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

async function call(method: string, url: string, body?: unknown, headers: Record<string, string> = { 'x-requested-with': 'mitv' }) {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, json: (await res.json()) as any };
}

test('info reports mock mode', async () => {
  const r = await call('GET', '/api/info');
  assert.equal(r.status, 200);
  assert.equal(r.json.mode, 'mock');
});

test('POST without the custom header is rejected (CSRF guard)', async () => {
  const r = await call('POST', '/api/key', { key: 'UP' }, {});
  assert.equal(r.status, 403);
});

test('unknown host header is rejected (DNS-rebinding guard)', async () => {
  const port = (server.address() as AddressInfo).port;
  const status = await new Promise<number>((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: '/api/info', headers: { host: `evil.example.com:${port}` } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      })
      .on('error', reject);
  });
  assert.equal(status, 403);
  assert.equal(isAllowedHost('localhost:8787'), true);
  assert.equal(isAllowedHost('192.168.1.20:8787'), true);
  assert.equal(isAllowedHost('evil.example.com'), false);
  assert.equal(isAllowedHost('laptop.local', ['laptop.local']), true);
});

test('key presses reach the device and unknown keys are rejected', async () => {
  assert.equal((await call('POST', '/api/key', { key: 'UP' })).status, 200);
  assert.equal(device.keys.at(-1), 'UP');
  assert.equal((await call('POST', '/api/key', { key: 'NOPE' })).status, 400);
});

test('text is typed; submit adds ENTER; Arabic is rejected clearly', async () => {
  device.typed = '';
  assert.equal((await call('POST', '/api/text', { text: 'stranger things', submit: true })).status, 200);
  assert.equal(device.typed, 'stranger things');
  assert.equal(device.keys.at(-1), 'ENTER');
  const r = await call('POST', '/api/text', { text: 'مرحبا' });
  assert.equal(r.status, 422);
  assert.match(r.json.error, /ASCII/);
});

test('status has memory and network', async () => {
  const r = await call('GET', '/api/status');
  assert.equal(r.json.connected, true);
  assert.ok(r.json.memory.totalMb > 0);
  assert.equal(r.json.network.ssid, 'MockWiFi');
});

test('shortcuts: list, run, pin, unpin', async () => {
  const list = await call('GET', '/api/shortcuts');
  assert.ok(list.json.some((s: any) => s.id === 'netflix'));

  assert.equal((await call('POST', '/api/shortcuts/netflix/run')).status, 200);
  assert.equal(device.foreground, 'com.netflix.ninja');
  assert.equal((await call('POST', '/api/shortcuts/does-not-exist/run')).status, 404);

  const pinned = await call('POST', '/api/shortcuts', {
    label: 'Kodi',
    group: 'Apps',
    action: { type: 'app', package: 'org.xbmc.kodi' },
  });
  assert.equal(pinned.status, 200);
  assert.equal(pinned.json.custom, true);
  assert.ok((await call('GET', '/api/shortcuts')).json.some((s: any) => s.id === pinned.json.id));

  assert.equal((await call('DELETE', `/api/shortcuts/${pinned.json.id}`)).status, 200);
  assert.ok(!(await call('GET', '/api/shortcuts')).json.some((s: any) => s.id === pinned.json.id));
  assert.equal((await call('DELETE', '/api/shortcuts/netflix')).status, 403);
});

test('invalid shortcuts are rejected', async () => {
  const bad = await call('POST', '/api/shortcuts', { label: 'x', action: { type: 'app', package: 'not a package; rm -rf /' } });
  assert.equal(bad.status, 400);
});

test('apps list and action log', async () => {
  const apps = await call('GET', '/api/apps');
  assert.ok(apps.json.length > 0 && typeof apps.json[0].package === 'string');
  const log = await call('GET', '/api/log');
  assert.ok(log.json.length > 0);
  assert.ok(log.json.some((e: any) => e.kind === 'text' && e.ok === false), 'failed Arabic attempt is logged');
});

test('killing an app removes its processes; bad names are rejected', async () => {
  const before = (await call('GET', '/api/processes')).json;
  assert.ok(before.some((p: any) => p.name === 'com.google.android.katniss:search'));
  assert.equal((await call('POST', '/api/processes/kill', { package: 'com.google.android.katniss' })).status, 200);
  assert.deepEqual(device.killed, ['com.google.android.katniss']);
  const after = (await call('GET', '/api/processes')).json;
  assert.ok(!after.some((p: any) => p.name.startsWith('com.google.android.katniss')));
  assert.equal((await call('POST', '/api/processes/kill', { package: 'x; reboot' })).status, 400);
  assert.equal((await call('POST', '/api/processes/kill', {})).status, 400);
});

test('processes are listed biggest first', async () => {
  const r = await call('GET', '/api/processes');
  assert.equal(r.status, 200);
  assert.ok(r.json.length > 1);
  assert.ok(r.json[0].memoryMb >= r.json[1].memoryMb);
  assert.equal(typeof r.json[0].name, 'string');
});
