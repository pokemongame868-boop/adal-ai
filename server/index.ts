import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env (server-side only) if present. Node >= 20.12.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));

const { chat, complaint, feedback, health } = await import('./handlers.ts');
const { createRateLimiter } = await import('./rateLimit.ts');
const { readAIConfig } = await import('./config.ts');
const { readSupabaseConfig } = await import('./supabase.ts');

const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 64 * 1024;
const allow = createRateLimiter(Number(process.env.RATE_LIMIT_PER_MIN || 20));
const allowFeedback = createRateLimiter(Number(process.env.FEEDBACK_RATE_LIMIT_PER_MIN || 3));
const distDir = join(root, 'dist');
const serveStatic = process.env.NODE_ENV === 'production' || existsSync(join(distDir, 'index.html'));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

function securityHeaders(res: ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
}

function sendJson(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
}

function serveFile(req: IncomingMessage, res: ServerResponse) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = normalize(join(distDir, urlPath));
  if (!file.startsWith(distDir)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(distDir, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Build not found. Run `npm run build`.');
    return;
  }
  const ext = extname(file);
  const cache = file.includes(`${join(distDir, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': cache });
  res.end(readFileSync(file));
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  securityHeaders(res);
  const path = (req.url || '/').split('?')[0];
  res.on('finish', () => {
    // Log metadata only — never request bodies or user messages.
    if (path.startsWith('/api/')) console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`);
  });

  try {
    if (path === '/api/health' && req.method === 'GET') {
      const r = health();
      return sendJson(res, r.status, r.body);
    }
    if (path === '/api/chat' || path === '/api/complaint' || path === '/api/feedback') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
      if (!String(req.headers['content-type'] || '').includes('application/json'))
        return sendJson(res, 415, { error: 'unsupported_media_type' });
      const rl = (path === '/api/feedback' ? allowFeedback : allow)(clientIp(req));
      if (!rl.allowed) return sendJson(res, 429, { error: 'rate_limited' }, { 'retry-after': String(rl.retryAfter) });
      let body: unknown;
      try {
        body = await readBody(req);
      } catch (e) {
        const msg = (e as Error).message;
        return sendJson(res, msg === 'too_large' ? 413 : 400, { error: msg });
      }
      const r = path === '/api/chat' ? await chat(body) : path === '/api/complaint' ? await complaint(body) : await feedback(body);
      return sendJson(res, r.status, r.body);
    }
    if (path.startsWith('/api/')) return sendJson(res, 404, { error: 'not_found' });
    if (serveStatic && (req.method === 'GET' || req.method === 'HEAD')) return serveFile(req, res);
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  } catch {
    if (!res.headersSent) sendJson(res, 500, { error: 'internal' });
  }
});

server.listen(PORT, () => {
  const cfg = readAIConfig();
  const sb = readSupabaseConfig();
  console.log(`ADAL server on http://localhost:${PORT}`);
  console.log(`  AI: ${cfg ? `live (${cfg.label}, model ${cfg.model})` : 'DEMO — set AIHUBMIX_ACCESS_KEY and AIHUBMIX_MODEL'}`);
  console.log(`  Feedback storage: ${sb ? 'Supabase (configured; apply supabase/schema.sql)' : 'not configured — form stays local-only (set SUPABASE_URL and SUPABASE_ANON_KEY)'}`);
});
