export default async function handler(req: { method?: string; body?: { messages?: unknown } }, res: { status: (code: number) => { json: (body: unknown) => void } }) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const key = process.env.OPENROUTER_API_KEY?.trim();
  const messages = req.body?.messages;
  if (!key) return res.status(503).json({ error: 'ai_not_configured' });
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages_required' });
  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'minimax/minimax-m3.1-flash:free',
        messages,
        max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS || 3000),
        temperature: Number(process.env.OPENROUTER_TEMPERATURE || 0.4),
      }),
    });
    const data = await upstream.json() as { choices?: Array<{ message?: { content?: string } }>; error?: unknown };
    if (!upstream.ok) return res.status(502).json({ error: 'upstream', detail: data.error ?? upstream.status });
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return res.status(502).json({ error: 'invalid_response' });
    return res.status(200).json({ reply, lang: 'ru', demo: false });
  } catch (error) {
    console.error('[vercel] openrouter request failed', error);
    return res.status(502).json({ error: 'upstream' });
  }
}
