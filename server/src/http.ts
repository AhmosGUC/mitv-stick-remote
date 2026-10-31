import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UserError } from './device.ts';

export interface Ctx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}
export type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

interface Route {
  method: string;
  re: RegExp;
  names: string[];
  handler: Handler;
}

/** Tiny router: `/api/shortcuts/:id/run` style patterns, no dependencies. */
export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): void {
    const names: string[] = [];
    const src = pattern.replace(/:([A-Za-z]+)/g, (_m, name: string) => {
      names.push(name);
      return '([^/]+)';
    });
    this.routes.push({ method, re: new RegExp(`^${src}$`), names, handler });
  }
  get(pattern: string, handler: Handler): void {
    this.add('GET', pattern, handler);
  }
  post(pattern: string, handler: Handler): void {
    this.add('POST', pattern, handler);
  }
  delete(pattern: string, handler: Handler): void {
    this.add('DELETE', pattern, handler);
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | 'method' | null {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params: Record<string, string> = {};
      r.names.forEach((n, i) => {
        params[n] = decodeURIComponent(m[i + 1] ?? '');
      });
      return { handler: r.handler, params };
    }
    return pathMatched ? 'method' : null;
  }
}

/**
 * Guards against DNS-rebinding: only localhost, IP literals and explicitly
 * allowed host names may talk to the API.
 */
export function isAllowedHost(hostHeader: string | undefined, extra: string[] = []): boolean {
  if (!hostHeader) return false;
  const host = (hostHeader.startsWith('[') ? hostHeader.slice(0, hostHeader.indexOf(']') + 1) : (hostHeader.split(':')[0] ?? '')).toLowerCase();
  if (host === 'localhost' || host === '[::1]') return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return extra.map((h) => h.toLowerCase()).includes(host);
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > 64 * 1024) throw new UserError('Request body too large.', 413);
    chunks.push(buf);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new UserError('Invalid JSON body.', 400);
  }
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

async function serveStatic(staticDir: string, pathname: string, res: http.ServerResponse): Promise<void> {
  const root = path.resolve(staticDir);
  let file = path.resolve(root, `.${decodeURIComponent(pathname)}`);
  if (file !== root && !file.startsWith(root + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  let stat = await fs.stat(file).catch(() => null);
  if (stat?.isDirectory()) {
    file = path.join(file, 'index.html');
    stat = await fs.stat(file).catch(() => null);
  }
  if (!stat) {
    // Single-page-app fallback.
    file = path.join(root, 'index.html');
    stat = await fs.stat(file).catch(() => null);
    if (!stat) {
      sendJson(res, 404, { error: 'UI not built. Run `npm run build` or use `npm run dev`.' });
      return;
    }
  }
  const data = await fs.readFile(file);
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  res.end(data);
}

export interface HttpOptions {
  staticDir?: string;
  allowedHosts?: string[];
}

export function createHttpServer(router: Router, opts: HttpOptions = {}): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (!isAllowedHost(req.headers.host, opts.allowedHosts)) {
        throw new UserError('Host not allowed. Set ALLOWED_HOSTS to add a host name.', 403);
      }
      const method = req.method ?? 'GET';

      if (url.pathname.startsWith('/api/')) {
        // A custom header forces a CORS preflight, so other websites cannot drive the TV.
        if (method !== 'GET' && req.headers['x-requested-with'] !== 'mitv') {
          throw new UserError('Missing X-Requested-With header.', 403);
        }
        const found = router.match(method, url.pathname);
        if (found === null) throw new UserError('Not found.', 404);
        if (found === 'method') throw new UserError('Method not allowed.', 405);
        const body = method === 'POST' ? await readJson(req) : {};
        const result = await found.handler({ params: found.params, query: url.searchParams, body });
        sendJson(res, 200, result === undefined ? { ok: true } : result);
        return;
      }

      if (method !== 'GET' && method !== 'HEAD') throw new UserError('Method not allowed.', 405);
      if (!opts.staticDir) throw new UserError('Not found.', 404);
      await serveStatic(opts.staticDir, url.pathname, res);
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (e instanceof UserError) {
        sendJson(res, e.status, { error: e.message });
      } else {
        console.error(e);
        sendJson(res, 500, { error: e instanceof Error ? e.message : 'Internal error' });
      }
    }
  });
}
