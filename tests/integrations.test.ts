import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chat, feedback, health } from '../server/handlers.ts';
import { readAIConfig, missingConfig, AIHUBMIX_BASE_URL, type AIConfig } from '../server/config.ts';
import { readSupabaseConfig, missingSupabaseConfig } from '../server/supabase.ts';
import { validateFeedbackBody } from '../server/validation.ts';

const cfg: AIConfig = { provider: 'openai', label: 'aihubmix', baseUrl: AIHUBMIX_BASE_URL, apiKey: 'test-key', model: 'mock-model', timeoutMs: 2000, maxTokens: 500, temperature: 0.4 };
const ru = { messages: [{ role: 'user', content: 'Мне требуют деньги за оценку. Что делать?' }] };

test('AIHubMix config: env names, base URL, placeholders, alias', () => {
  const c = readAIConfig({ AIHUBMIX_ACCESS_KEY: 'k', AIHUBMIX_MODEL: 'm' });
  assert.ok(c);
  assert.equal(c.baseUrl, 'https://aihubmix.com/v1');
  assert.equal(c.label, 'aihubmix');
  assert.ok(readAIConfig({ AIHUBMIX_API_KEY: 'k', AIHUBMIX_MODEL: 'm' }));
  assert.equal(readAIConfig({ AIHUBMIX_ACCESS_KEY: 'your_api_key_here', AIHUBMIX_MODEL: 'your_available_model_id' }), null);
  assert.equal(readAIConfig({ AIHUBMIX_ACCESS_KEY: 'k' }), null);
  assert.deepEqual(missingConfig({}), ['OPENROUTER_API_KEY']);
  assert.deepEqual(missingConfig({ AI_PROVIDER: 'aihubmix' }), ['AIHUBMIX_ACCESS_KEY', 'AIHUBMIX_MODEL']);
  assert.deepEqual(missingConfig({ AIHUBMIX_ACCESS_KEY: 'k' }), ['AIHUBMIX_MODEL']);
  assert.equal(readAIConfig({ AIHUBMIX_ACCESS_KEY: 'k', AIHUBMIX_MODEL: 'm', AIHUBMIX_TEMPERATURE: 'default' })!.temperature, undefined);
  assert.equal(readAIConfig({ AIHUBMIX_ACCESS_KEY: 'k', AIHUBMIX_MODEL: 'm', AIHUBMIX_BASE_URL: 'http://evil' }), null);
});

test('AIHubMix request: POST {base}/chat/completions with Bearer key, model, system prompt', async () => {
  let url = '';
  let init: RequestInit = {};
  const f = (async (u: string, i: RequestInit) => {
    url = u; init = i;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Ответ' } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await chat(ru, { config: cfg, fetchImpl: f });
  assert.equal(r.status, 200);
  assert.equal(url, 'https://aihubmix.com/v1/chat/completions');
  assert.equal((init.headers as Record<string, string>).authorization, 'Bearer test-key');
  const body = JSON.parse(String(init.body));
  assert.equal(body.model, 'mock-model');
  assert.equal(body.messages[0].role, 'system');
});

test('400 from model params => one retry without temperature/max_tokens', async () => {
  const bodies: Record<string, unknown>[] = [];
  const f = (async (_u: string, i: RequestInit) => {
    bodies.push(JSON.parse(String(i.body)));
    if (bodies.length === 1) return new Response('{"error":{"message":"Unsupported parameter: temperature"}}', { status: 400 });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await chat(ru, { config: cfg, fetchImpl: f });
  assert.equal(r.status, 200);
  assert.equal(bodies.length, 2);
  assert.ok('temperature' in bodies[0] && 'max_tokens' in bodies[0]);
  assert.ok(!('temperature' in bodies[1]) && !('max_tokens' in bodies[1]));
});

test('AIHubMix error mapping (quota, model, auth, rate limit, invalid)', async () => {
  const cases: [number, string, string][] = [
    [403, '{"error":{"code":"insufficient_user_quota"},"tid":"abc123"}', 'quota'],
    [403, '{"error":{"message":"Forbidden – key not authorized to access the requested model"}}', 'auth'],
    [401, '{}', 'auth'],
    [503, '{"error":{"message":"Incorrect model ID"}}', 'model_unavailable'],
    [429, '{}', 'rate_limited'],
    [500, 'oops', 'upstream'],
  ];
  for (const [status, text, code] of cases) {
    const f = (async () => new Response(text, { status })) as unknown as typeof fetch;
    const r = await chat(ru, { config: cfg, fetchImpl: f });
    assert.equal(r.body.error, code, `HTTP ${status}`);
    assert.ok(!JSON.stringify(r.body).includes('test-key'));
  }
  const empty = (async () => new Response(JSON.stringify({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }), { status: 200 })) as unknown as typeof fetch;
  assert.equal((await chat(ru, { config: cfg, fetchImpl: empty })).body.error, 'invalid_response');
});

test('Supabase config: placeholders => not configured; publishable key alias', () => {
  assert.equal(readSupabaseConfig({}), null);
  assert.equal(readSupabaseConfig({ SUPABASE_URL: 'your_supabase_project_url', SUPABASE_ANON_KEY: 'your_supabase_publishable_or_anon_key' }), null);
  assert.ok(readSupabaseConfig({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }));
  assert.deepEqual(missingSupabaseConfig({}), ['SUPABASE_URL', 'SUPABASE_ANON_KEY']);
  assert.equal(health({ config: null, supabase: null }).body.feedbackStorage, 'local');
  assert.equal(health({ config: null, supabase: { url: 'https://x.supabase.co', key: 'k' } }).body.feedbackStorage, 'supabase');
});

test('feedback validation mirrors the client rules', () => {
  assert.ok(validateFeedbackBody({ category: 'idea', message: 'Добавьте тёмную тему', contact: '', lang: 'ru' }).ok);
  assert.equal((validateFeedbackBody({ category: 'x', message: 'Добавьте тёмную тему', lang: 'ru' }) as { error: string }).error, 'invalid_category');
  assert.equal((validateFeedbackBody({ category: 'idea', message: 'коротко', lang: 'ru' }) as { error: string }).error, 'invalid_message');
  assert.equal((validateFeedbackBody({ category: 'idea', message: 'Мой ИИН 990101300123 пожалуйста', lang: 'ru' }) as { error: string }).error, 'sensitive_data');
  assert.equal((validateFeedbackBody({ category: 'idea', message: 'Добавьте тёмную тему', contact: 'nope', lang: 'kk' }) as { error: string }).error, 'invalid_contact');
});

test('feedback: not configured => 503, never claims storage', async () => {
  const r = await feedback({ category: 'idea', message: 'Добавьте тёмную тему', lang: 'ru' }, { supabase: null });
  assert.equal(r.status, 503);
  assert.equal(r.body.stored, undefined);
});

test('feedback: inserts via PostgREST with anon key, return=minimal, no select', async () => {
  let url = '';
  let init: RequestInit = {};
  const f = (async (u: string | URL, i: RequestInit) => {
    url = String(u); init = i;
    return new Response(null, { status: 201 });
  }) as unknown as typeof fetch;
  const r = await feedback(
    { category: 'ux', message: 'Сделайте кнопку крупнее', contact: 'a@b.kz', lang: 'ru' },
    { supabase: { url: 'https://proj.supabase.co', key: 'anon-key' }, fetchImpl: f },
  );
  assert.equal(r.status, 201);
  assert.equal(r.body.stored, true);
  assert.match(url, /^https:\/\/proj\.supabase\.co\/rest\/v1\/feedback/);
  assert.ok(!url.includes('select='));
  const h = new Headers(init.headers);
  assert.equal(h.get('apikey'), 'anon-key');
  assert.doesNotMatch(h.get('prefer') || '', /return=representation/); // PostgREST default = minimal
  assert.deepEqual(JSON.parse(String(init.body)), { category: 'ux', message: 'Сделайте кнопку крупнее', contact_email: 'a@b.kz', lang: 'ru' });
});

test('feedback: database rejection => error, not success', async () => {
  const f = (async () => new Response(JSON.stringify({ code: '42501', message: 'permission denied' }), { status: 401, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
  const r = await feedback({ category: 'bug', message: 'Кнопка не работает', lang: 'kk' }, { supabase: { url: 'https://p.supabase.co', key: 'k' }, fetchImpl: f });
  assert.equal(r.status, 502);
  assert.equal(r.body.error, 'storage_rejected');
});
