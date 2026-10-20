export default function handler(_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) {
  return res.status(200).json({ ok: true, mode: 'live-test' });
}
