import type { IncomingMessage, ServerResponse } from 'node:http';
import { chat, complaint, feedback, health } from '../server/handlers.ts';

type VercelRequest = IncomingMessage & { method?: string; query?: Record<string, string | string[]> };
type VercelResponse = ServerResponse & { status: (code: number) => VercelResponse; json: (body: unknown) => void };

async function bodyOf(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = Array.isArray(req.query?.route) ? req.query.route.join('/') : (req.query?.route || '');
  if (req.method === 'GET' && route === 'health') return res.status(200).json(health().body);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const input = await bodyOf(req);
  const result = route === 'chat' ? await chat(input) : route === 'complaint' ? await complaint(input) : route === 'feedback' ? await feedback(input) : null;
  if (!result) return res.status(404).json({ error: 'not_found' });
  return res.status(result.status).json(result.body);
}
