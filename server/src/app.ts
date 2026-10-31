import type http from 'node:http';
import { ActionLog } from './actionLog.ts';
import { UserError } from './device.ts';
import type { Device } from './device.ts';
import { Router, createHttpServer } from './http.ts';
import { isKeyName } from './keys.ts';
import { normalizeTypedText } from './parse.ts';
import { addCustomShortcut, loadShortcuts, removeCustomShortcut } from './shortcuts.ts';
import type { ShortcutAction } from './shortcuts.ts';

export interface AppOptions {
  device: Device;
  /** Folder holding shortcuts.json (and shortcuts.local.json). */
  configDir: string;
  staticDir?: string;
  allowedHosts?: string[];
}

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new UserError('Expected a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function createApp(opts: AppOptions): http.Server {
  const { device, configDir } = opts;
  const log = new ActionLog();
  const router = new Router();

  // Device commands run one at a time, in the order they arrive.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn);
    chain = p.catch(() => undefined);
    return p;
  };

  async function act<T>(kind: string, detail: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    try {
      const result = await serial(fn);
      log.add({ kind, detail, ok: true, ms: Date.now() - t0 });
      return result;
    } catch (e) {
      log.add({ kind, detail, ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  }

  async function runAction(action: ShortcutAction): Promise<void> {
    switch (action.type) {
      case 'app':
        return device.launch({ type: 'app', package: action.package });
      case 'intent':
        return device.launch(
          action.data === undefined
            ? { type: 'intent', action: action.action }
            : { type: 'intent', action: action.action, data: action.data },
        );
      case 'keys':
        for (const k of action.keys) await device.key(k);
        return;
      case 'text':
        return device.text(action.text);
    }
  }

  router.get('/api/info', () => ({ mode: device.mode, label: device.label }));

  router.get('/api/status', () => device.status());

  router.post('/api/key', async ({ body }) => {
    const { key } = asObject(body);
    if (!isKeyName(key)) throw new UserError('Unknown key.');
    await act('key', key, () => device.key(key));
  });

  router.post('/api/text', async ({ body }) => {
    const { text, submit } = asObject(body);
    if (typeof text !== 'string') throw new UserError('text must be a string.');
    // Validate inside the logged action so rejected attempts (e.g. Arabic) show up in the log.
    await act('text', text.length > 40 ? `${text.slice(0, 40)}…` : text, async () => {
      await device.text(normalizeTypedText(text));
      if (submit === true) await device.key('ENTER');
    });
  });

  router.post('/api/launch', async ({ body }) => {
    const { package: pkg } = asObject(body);
    if (typeof pkg !== 'string') throw new UserError('package must be a string.');
    await act('launch', pkg, () => device.launch({ type: 'app', package: pkg }));
  });

  router.get('/api/shortcuts', () => loadShortcuts(configDir));

  router.post('/api/shortcuts/:id/run', async ({ params }) => {
    const shortcut = (await loadShortcuts(configDir)).find((s) => s.id === params.id);
    if (!shortcut) throw new UserError('No such shortcut.', 404);
    await act('shortcut', shortcut.label, () => runAction(shortcut.action));
  });

  router.post('/api/shortcuts', async ({ body }) => addCustomShortcut(configDir, body));

  router.delete('/api/shortcuts/:id', async ({ params }) => {
    await removeCustomShortcut(configDir, params.id ?? '');
  });

  router.get('/api/apps', () => act('apps', 'list installed apps', () => device.listApps()));

  router.get('/api/log', () => log.list());

  return createHttpServer(router, {
    ...(opts.staticDir === undefined ? {} : { staticDir: opts.staticDir }),
    ...(opts.allowedHosts === undefined ? {} : { allowedHosts: opts.allowedHosts }),
  });
}
