import type { IncomingMessage, ServerResponse } from 'node:http';
import { chat, complaint, feedback, health } from '../server/handlers.ts';

type VercelRequest = IncomingMessage & { method?: string; query?: Record<string, string | string[]> };
type VercelResponse = ServerResponse & { status?: (code: number) => VercelResponse; json?: (body: unknown) => void };

function send(res: VercelResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(data);
}

async function bodyOf(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fromQuery = Array.isArray(req.query?.route) ? req.query.route.join('/') : req.query?.route;
  const fromUrl = req.url?.split('?')[0].replace(/^\/api\/?/, '').replace(/\/$/, '');
  const route = String(fromQuery || fromUrl || '');
  try {
    if (req.method === 'GET' && route === 'health') return send(res, 200, health().body);
    if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
    const input = await bodyOf(req);
    const result = route === 'chat' ? await chat(input) : route === 'complaint' ? await complaint(input) : route === 'feedback' ? await feedback(input) : null;
    if (!result) return send(res, 404, { error: 'not_found' });
    return send(res, result.status, result.body);
  } catch (error) {
    console.error('[vercel] api handler failed', error);
    return send(res, 500, { error: 'internal' });
  }
}
