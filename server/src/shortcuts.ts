import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { UserError } from './device.ts';
import { KEY_NAMES, isKeyName } from './keys.ts';
import type { KeyName } from './keys.ts';
import { ACTION_RE, PACKAGE_RE } from './parse.ts';

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
  /** True for shortcuts the user pinned (stored in shortcuts.local.json). */
  custom?: boolean;
}

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,48}$/i;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateAction(input: unknown): ShortcutAction {
  if (!isRecord(input)) throw new UserError('Shortcut action must be an object.');
  switch (input.type) {
    case 'app': {
      if (typeof input.package !== 'string' || !PACKAGE_RE.test(input.package)) {
        throw new UserError('Invalid package name.');
      }
      return { type: 'app', package: input.package };
    }
    case 'intent': {
      if (typeof input.action !== 'string' || !ACTION_RE.test(input.action)) {
        throw new UserError('Invalid intent action.');
      }
      if (input.data !== undefined && (typeof input.data !== 'string' || input.data.length > 500)) {
        throw new UserError('Invalid intent data.');
      }
      return input.data === undefined
        ? { type: 'intent', action: input.action }
        : { type: 'intent', action: input.action, data: input.data };
    }
    case 'keys': {
      const keys = input.keys;
      if (!Array.isArray(keys) || keys.length === 0 || keys.length > 20 || !keys.every(isKeyName)) {
        throw new UserError(`keys must be a non-empty list of: ${KEY_NAMES.join(', ')}`);
      }
      return { type: 'keys', keys: keys as KeyName[] };
    }
    case 'text': {
      if (typeof input.text !== 'string' || input.text.length === 0 || input.text.length > 200) {
        throw new UserError('Invalid text.');
      }
      return { type: 'text', text: input.text };
    }
    default:
      throw new UserError('Unknown shortcut type (use app, intent, keys or text).');
  }
}

export function validateShortcut(input: unknown): Shortcut {
  if (!isRecord(input)) throw new UserError('Shortcut must be an object.');
  const { id, label, group } = input;
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new UserError('Invalid shortcut id.');
  if (typeof label !== 'string' || label.trim().length === 0 || label.length > 40) {
    throw new UserError('Label must be 1-40 characters.');
  }
  if (group !== undefined && (typeof group !== 'string' || group.length === 0 || group.length > 30)) {
    throw new UserError('Invalid group.');
  }
  return {
    id,
    label: label.trim(),
    group: typeof group === 'string' ? group : 'Apps',
    action: validateAction(input.action),
  };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'shortcut';
}

async function readJsonFile(file: string): Promise<unknown[]> {
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return [];
    throw e;
  }
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new UserError(`${path.basename(file)} must contain a JSON array.`, 500);
  return parsed;
}

const BASE = 'shortcuts.json';
const LOCAL = 'shortcuts.local.json';

export async function loadShortcuts(configDir: string): Promise<Shortcut[]> {
  const base = (await readJsonFile(path.join(configDir, BASE))).map(validateShortcut);
  const seen = new Set(base.map((s) => s.id));
  const local: Shortcut[] = [];
  for (const raw of await readJsonFile(path.join(configDir, LOCAL))) {
    const s = validateShortcut(raw);
    if (!seen.has(s.id)) {
      seen.add(s.id);
      local.push({ ...s, custom: true });
    }
  }
  return [...base, ...local];
}

async function writeLocal(configDir: string, list: Shortcut[]): Promise<void> {
  const file = path.join(configDir, LOCAL);
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
  const clean = list.map(({ custom: _custom, ...rest }) => rest);
  await fs.writeFile(tmp, `${JSON.stringify(clean, null, 2)}\n`);
  await fs.rename(tmp, file);
}

/** Pin a user-defined shortcut. An id is generated from the label when none is given. */
export async function addCustomShortcut(configDir: string, input: unknown): Promise<Shortcut> {
  if (!isRecord(input)) throw new UserError('Shortcut must be an object.');
  const all = await loadShortcuts(configDir);
  const label = typeof input.label === 'string' ? input.label : '';
  let id = typeof input.id === 'string' ? input.id : `${slug(label)}-${randomBytes(2).toString('hex')}`;
  if (all.some((s) => s.id === id)) id = `${slug(label)}-${randomBytes(2).toString('hex')}`;
  const shortcut = validateShortcut({ ...input, id });
  const local = all.filter((s) => s.custom);
  await writeLocal(configDir, [...local, shortcut]);
  return { ...shortcut, custom: true };
}

export async function removeCustomShortcut(configDir: string, id: string): Promise<void> {
  const all = await loadShortcuts(configDir);
  const target = all.find((s) => s.id === id);
  if (!target) throw new UserError('No such shortcut.', 404);
  if (!target.custom) throw new UserError('Built-in shortcuts live in config/shortcuts.json; edit that file to remove one.', 403);
  await writeLocal(configDir, all.filter((s) => s.custom && s.id !== id));
}
