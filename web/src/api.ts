import type { DeviceStatus, Info, InstalledApp, KeyName, LogEntry, ProcessMemory, Shortcut, ShortcutAction } from './types';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    // The custom header is required by the server (blocks other websites from driving the TV).
    headers: { 'content-type': 'application/json', 'x-requested-with': 'mitv' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error;
    throw new Error(message ?? `${res.status} ${res.statusText}`);
  }
  return data as T;
}

export const api = {
  info: () => request<Info>('GET', '/info'),
  status: () => request<DeviceStatus>('GET', '/status'),
  key: (key: KeyName) => request<void>('POST', '/key', { key }),
  text: (text: string, submit = false) => request<void>('POST', '/text', { text, submit }),
  shortcuts: () => request<Shortcut[]>('GET', '/shortcuts'),
  runShortcut: (id: string) => request<void>('POST', `/shortcuts/${encodeURIComponent(id)}/run`),
  pinShortcut: (label: string, group: string, action: ShortcutAction) =>
    request<Shortcut>('POST', '/shortcuts', { label, group, action }),
  unpinShortcut: (id: string) => request<void>('DELETE', `/shortcuts/${encodeURIComponent(id)}`),
  apps: () => request<InstalledApp[]>('GET', '/apps'),
  processes: () => request<ProcessMemory[]>('GET', '/processes'),
  killApp: (pkg: string) => request<void>('POST', '/processes/kill', { package: pkg }),
  log: () => request<LogEntry[]>('GET', '/log'),
};
