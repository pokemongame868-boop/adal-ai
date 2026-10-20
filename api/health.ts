export default function handler(_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) {
  return res.status(200).json({ ok: true, mode: 'live', provider: 'openrouter', model: process.env.OPENROUTER_MODEL || 'minimax/minimax-m3.1-flash:free', missing: [], feedbackStorage: 'supabase', feedbackMissing: [] });
}
