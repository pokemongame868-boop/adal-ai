import { chat, complaint, feedback, health } from '../server/handlers.ts';

export async function run(kind: 'health' | 'chat' | 'complaint' | 'feedback', req: Request): Promise<Response> {
  if (kind === 'health' && req.method === 'GET') return Response.json(health().body);
  if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const result = kind === 'chat' ? await chat(body) : kind === 'complaint' ? await complaint(body) : await feedback(body);
  return Response.json(result.body, { status: result.status });
}
