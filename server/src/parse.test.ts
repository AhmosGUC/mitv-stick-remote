import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInputTextCommand,
  normalizeTypedText,
  parseFocus,
  parseIp,
  parseMeminfo,
  parsePackages,
  parseProcessMemory,
  parseStatusOutput,
  parseWifiInfo,
  shq,
} from './parse.ts';

test('shq quotes single quotes safely', () => {
  assert.equal(shq("it's"), `'it'\\''s'`);
});

test('buildInputTextCommand encodes spaces and quotes shell characters', () => {
  assert.equal(buildInputTextCommand('hello world'), "input text 'hello%sworld'");
  assert.equal(buildInputTextCommand('a&b;$(x)'), "input text 'a&b;$(x)'");
  assert.equal(buildInputTextCommand("o'neil"), `input text 'o'\\''neil'`);
});

test('normalizeTypedText rejects empty, long and non-ASCII text', () => {
  assert.equal(normalizeTypedText('line1\nline2'), 'line1 line2');
  assert.throws(() => normalizeTypedText(''), /Nothing to type/);
  assert.throws(() => normalizeTypedText('x'.repeat(501)), /too long/);
  assert.throws(() => normalizeTypedText('مرحبا'), (e: Error & { status?: number }) => e.status === 422);
});

test('parseMeminfo', () => {
  const m = parseMeminfo('MemTotal:        1888856 kB\nMemFree:          100000 kB\nMemAvailable:     812344 kB\n');
  assert.deepEqual(m, { totalMb: 1845, availableMb: 793, usedMb: 1052, usedPct: 57 });
  assert.equal(parseMeminfo('garbage'), null);
});

test('parseWifiInfo handles a typical dumpsys line', () => {
  const line =
    'mWifiInfo SSID: "Home WiFi", BSSID: aa:bb:cc:dd:ee:ff, MAC: 02:00:00:00:00:00, Supplicant state: COMPLETED, RSSI: -57, Link speed: 433Mbps, Tx Link speed: 433Mbps, Frequency: 5180MHz, Net ID: 0';
  assert.deepEqual(parseWifiInfo(line), { ssid: 'Home WiFi', rssi: -57, linkSpeedMbps: 433, frequencyMhz: 5180 });
  assert.deepEqual(parseWifiInfo('mWifiInfo SSID: <unknown ssid>, RSSI: -127'), { rssi: -127 });
});

test('parseIp', () => {
  assert.equal(parseIp('3: wlan0    inet 192.168.1.50/24 brd 192.168.1.255 scope global wlan0'), '192.168.1.50');
  assert.equal(parseIp(''), undefined);
});

test('parseFocus handles both mCurrentFocus and mFocusedApp', () => {
  assert.equal(
    parseFocus('  mCurrentFocus=Window{4f2a1 u0 com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity}'),
    'com.google.android.youtube.tv',
  );
  assert.equal(parseFocus('  mFocusedApp=ActivityRecord{9a u0 com.netflix.ninja/.MainActivity t12}'), 'com.netflix.ninja');
  assert.equal(parseFocus('  mCurrentFocus=null'), undefined);
});

test('parsePackages sorts and dedupes', () => {
  assert.deepEqual(parsePackages('package:com.b\r\npackage:com.a\npackage:com.b\nnoise\n'), ['com.a', 'com.b']);
});

test('parseStatusOutput splits the four sections', () => {
  const out = [
    'MemTotal:        1888856 kB',
    'MemAvailable:     812344 kB',
    '---',
    'mWifiInfo SSID: "Home", RSSI: -60, Link speed: 300Mbps, Frequency: 2437MHz',
    '---',
    '3: wlan0    inet 10.0.0.7/24 brd 10.0.0.255 scope global wlan0',
    '---',
    'mCurrentFocus=Window{1 u0 com.netflix.ninja/.Main}',
  ].join('\n');
  const s = parseStatusOutput(out);
  assert.equal(s.memory?.usedPct, 57);
  assert.deepEqual(s.network, { ssid: 'Home', rssi: -60, linkSpeedMbps: 300, frequencyMhz: 2437, ip: '10.0.0.7' });
  assert.equal(s.foregroundApp, 'com.netflix.ninja');
});

test('parseProcessMemory reads the PSS-by-process section, biggest first', () => {
  const out = [
    'Total PSS by process:',
    '     50,955K: com.google.android.gms (pid 31142)',
    '    229,252K: com.iptvstreamplayer.iptvstreamplayer (pid 6404 / activities)',
    '      1,720K: /init (pid 1)',
    '',
  ].join('\r\n');
  assert.deepEqual(parseProcessMemory(out), [
    { name: 'com.iptvstreamplayer.iptvstreamplayer', pid: 6404, memoryMb: 223.9, state: 'activities' },
    { name: 'com.google.android.gms', pid: 31142, memoryMb: 49.8 },
    { name: '/init', pid: 1, memoryMb: 1.7 },
  ]);
  assert.deepEqual(parseProcessMemory(''), []);
});
