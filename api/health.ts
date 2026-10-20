export default function handler() {
  return new Response(JSON.stringify({ ok: true, mode: 'live-test' }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
