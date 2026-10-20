import { chat, complaint, feedback, health } from './handlers.ts';

type Req = { method?: string; body?: unknown };
type Res = { status: (code: number) => { json: (body: unknown) => void } };

export async function runNode(kind: 'health' | 'chat' | 'complaint' | 'feedback', req: Req, res: Res) {
  try {
    if (kind === 'health' && req.method === 'GET') return res.status(200).json(health().body);
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const result = kind === 'chat' ? await chat(req.body) : kind === 'complaint' ? await complaint(req.body) : await feedback(req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(`[vercel] ${kind} failed`, error);
    return res.status(500).json({ error: 'internal' });
  }
}
