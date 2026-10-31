import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PersistentShell } from './adbShell.ts';

let dir = '';
let fakeAdb = '';

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mitv-shell-'));
  // Stands in for `adb -s <serial> shell`: a plain shell reading commands from stdin.
  fakeAdb = path.join(dir, 'adb');
  await fs.writeFile(fakeAdb, '#!/bin/sh\nexec sh\n', { mode: 0o755 });
});

after(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

test('runs commands in order on one shell and returns their output', async () => {
  const shell = new PersistentShell(fakeAdb, 'x:5555');
  try {
    const [a, b, c] = await Promise.all([shell.run('echo one'), shell.run('echo two'), shell.run('echo three')]);
    assert.equal(a.trim(), 'one');
    assert.equal(b.trim(), 'two');
    assert.equal(c.trim(), 'three');
    // state persists between commands, so it really is the same shell
    await shell.run('MITV_X=42');
    assert.equal((await shell.run('echo $MITV_X')).trim(), '42');
  } finally {
    shell.close();
  }
});

test('rejects on a non-zero exit and keeps working afterwards', async () => {
  const shell = new PersistentShell(fakeAdb, 'x:5555');
  try {
    await assert.rejects(shell.run('echo nope >&2; false'), /nope/);
    assert.equal((await shell.run('echo still-ok')).trim(), 'still-ok');
  } finally {
    shell.close();
  }
});

test('times out a stuck command, then starts a fresh shell', async () => {
  const shell = new PersistentShell(fakeAdb, 'x:5555', 300);
  try {
    await assert.rejects(shell.run('sleep 5'), /timed out/);
    assert.equal((await shell.run('echo back')).trim(), 'back');
  } finally {
    shell.close();
  }
});

test('restarts after the shell dies', async () => {
  const shell = new PersistentShell(fakeAdb, 'x:5555');
  try {
    await assert.rejects(shell.run('exit 3'));
    assert.equal((await shell.run('echo alive')).trim(), 'alive');
  } finally {
    shell.close();
  }
});

test('fails clearly when adb is missing', async () => {
  const shell = new PersistentShell(path.join(dir, 'no-such-adb'), 'x:5555');
  await assert.rejects(shell.run('echo hi'), /ENOENT/);
  shell.close();
});
