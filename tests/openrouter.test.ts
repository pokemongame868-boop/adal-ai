import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chat } from '../server/handlers.ts';
import { readAIConfig } from '../server/config.ts';
import { OpenRouterClient, readOpenRouterConfig, parseRetryAfter, describeError, OPENROUTER_DEFAULT_MODEL, type OpenRouterConfig } from '../server/openrouter.ts';
import { AIError } from '../server/errors.ts';
import { Semaphore, SemaphoreFullError } from '../server/semaphore.ts';

interface Call {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

type Responder = (call: Call, index: number) => Response | Promise<Response>;

function mockFetch(responder: Responder, calls: Call[] = []): typeof fetch {
  const f = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const raw = init?.body;
    const parsed: unknown = typeof raw === 'string' && raw ? JSON.parse(raw) : {};
    const call: Call = {
      url: String(input instanceof Request ? input.url : input),
      headers: new Headers(init?.headers),
      body: typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {},
    };
    calls.push(call);
    return responder(call, calls.length - 1);
  };
  return f as typeof fetch;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const ok = (content: string): Response =>
  json({ id: 'gen-1', object: 'chat.completion', created: 1, model: OPENROUTER_DEFAULT_MODEL, choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }] });

const baseCfg = (over: Partial<OpenRouterConfig> = {}): OpenRouterConfig => {
  const c = readOpenRouterConfig({ OPENROUTER_API_KEY: 'sk-or-test' });
  assert.ok(c);
  return { ...c, maxRetryDelayMs: 50, timeoutMs: 2000, ...over };
};

test('config: OPENROUTER_API_KEY enables OpenRouter with MiniMax M3.1 Flash (free) by default', () => {
  const c = readOpenRouterConfig({ OPENROUTER_API_KEY: 'sk-or-x' });
  assert.ok(c);
  assert.equal(c.baseUrl, 'https://openrouter.ai/api/v1');
  assert.equal(c.model, 'minimax/minimax-m3.1-flash:free');
  assert.equal(readOpenRouterConfig({ OPENROUTER_API_KEY: '' }), null);
  assert.equal(readOpenRouterConfig({}), null);
  const ai = readAIConfig({ OPENROUTER_API_KEY: 'sk-or-x', AIHUBMIX_ACCESS_KEY: 'k', AIHUBMIX_MODEL: 'm' });
  assert.equal(ai?.provider, 'openrouter');
  assert.equal(readAIConfig({ AI_PROVIDER: 'aihubmix', OPENROUTER_API_KEY: 'sk-or-x', AIHUBMIX_ACCESS_KEY: 'k', AIHUBMIX_MODEL: 'm' })?.label, 'aihubmix');
});

test('ask(): official SDK hits {base}/chat/completions with Bearer key and model', async () => {
  const calls: Call[] = [];
  const client = new OpenRouterClient(baseCfg(), mockFetch(() => ok('Ответ'), calls));
  assert.equal(await client.ask('Привет'), 'Ответ');
  assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(calls[0].headers.get('authorization'), 'Bearer sk-or-test');
  assert.equal(calls[0].body.model, 'minimax/minimax-m3.1-flash:free');
  assert.equal(calls[0].body.tools, undefined);
  assert.equal(calls[0].body.response_format, undefined);
});

test('retries 429 (Retry-After) and 5xx, then succeeds', async () => {
  const calls: Call[] = [];
  const f = mockFetch((_c, i) => (i === 0 ? json({ error: { code: 429, message: 'Rate limit exceeded: free-models-per-min' } }, 429, { 'retry-after': '0' }) : i === 1 ? json({ error: { code: 502, message: 'bad gateway' } }, 502) : ok('done')), calls);
  const client = new OpenRouterClient(baseCfg({ maxRetries: 2 }), f);
  assert.equal(await client.ask('x'), 'done');
  assert.equal(calls.length, 3);
});

test('daily free-model limit => free_limit immediately, no retries, clear message', async () => {
  const calls: Call[] = [];
  const reset = String(Date.now() + 6 * 3600_000);
  const f = mockFetch(() => json({ error: { code: 429, message: 'Rate limit exceeded: free-models-per-day' } }, 429, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset }), calls);
  const client = new OpenRouterClient(baseCfg({ maxRetries: 2 }), f);
  await assert.rejects(client.ask('x'), (e: unknown) => e instanceof AIError && e.code === 'free_limit');
  assert.equal(calls.length, 1);
  assert.match(describeError(new AIError('free_limit', '')), /лимит бесплатной модели/);
  assert.match(describeError(new AIError('free_limit', ''), 'kk'), /лимиті таусылды/);
});

test('no retry on 401 / 400; long Retry-After is not waited for', async () => {
  for (const [status, code] of [[401, 'auth'], [400, 'bad_request'], [402, 'quota'], [404, 'model_unavailable']] as const) {
    const calls: Call[] = [];
    const client = new OpenRouterClient(baseCfg(), mockFetch(() => json({ error: { code: status, message: 'x' } }, status), calls));
    await assert.rejects(client.ask('x'), (e: unknown) => e instanceof AIError && e.code === code);
    assert.equal(calls.length, 1, `HTTP ${status}`);
  }
  const calls: Call[] = [];
  const client = new OpenRouterClient(baseCfg(), mockFetch(() => json({ error: { code: 429, message: 'slow down' } }, 429, { 'retry-after': '120' }), calls));
  await assert.rejects(client.ask('x'), (e: unknown) => e instanceof AIError && e.code === 'rate_limited');
  assert.equal(calls.length, 1);
});

test('timeout => timeout error (not retried)', async () => {
  const calls: Call[] = [];
  let signal: AbortSignal | null | undefined;
  const base = mockFetch(() => new Promise<Response>((_res, rej) => {
    signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }), calls);
  const hang = ((input: string | URL | Request, init?: RequestInit) => {
    signal = init?.signal;
    return base(input, init);
  }) as typeof fetch;
  const client = new OpenRouterClient(baseCfg({ timeoutMs: 100 }), hang);
  await assert.rejects(client.ask('x'), (e: unknown) => e instanceof AIError && e.code === 'timeout');
  assert.equal(calls.length, 1);
});

test('invalid responses: HTTP 200 with error body, empty content', async () => {
  const c1 = new OpenRouterClient(baseCfg(), mockFetch(() => json({ error: { code: 502, message: 'provider error' } })));
  await assert.rejects(c1.ask('x'), (e: unknown) => e instanceof AIError && e.code === 'invalid_response');
  const c2 = new OpenRouterClient(baseCfg(), mockFetch(() => json({ choices: [{ index: 0, finish_reason: 'length', message: { role: 'assistant', content: '' } }] })));
  await assert.rejects(c2.ask('x'), (e: unknown) => e instanceof AIError && e.code === 'invalid_response');
});

test('concurrency is limited by the semaphore', async () => {
  let active = 0;
  let peak = 0;
  const f = mockFetch(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 30));
    active--;
    return ok('ok');
  });
  const client = new OpenRouterClient(baseCfg({ maxConcurrency: 2, maxQueue: 10 }), f);
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => client.ask(`q${i}`)));
  assert.equal(results.length, 6);
  assert.equal(peak, 2);
  const s = new Semaphore(1, 0);
  await s.acquire(100);
  await assert.rejects(s.acquire(100), (e: unknown) => e instanceof SemaphoreFullError);
});

test('capability probe: separate requests; supported vs unsupported', async () => {
  const calls: Call[] = [];
  const f = mockFetch((c) => {
    if (c.url.endsWith('/models')) return json({ data: [{ id: OPENROUTER_DEFAULT_MODEL, supported_parameters: ['tools', 'response_format'] }] });
    if (c.body.tools) return json({ choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'get_server_time', arguments: '{"timezone":"Asia/Almaty"}' } }] } }] });
    if (c.body.response_format) return ok('```json\n{"city":"Astana","year":1997}\n```');
    return ok('x');
  }, calls);
  const report = await new OpenRouterClient(baseCfg(), f).probeCapabilities();
  assert.equal(report.toolCalling.status, 'supported');
  assert.equal(report.structuredOutputs.status, 'unsupported'); // fenced JSON => schema not enforced
  assert.deepEqual(report.advertised, ['tools', 'response_format']);
  assert.equal(calls.filter((c) => c.url.endsWith('/chat/completions')).length, 2);

  const f2 = mockFetch((c) => (c.url.endsWith('/models') ? json({ data: [] }) : c.body.tools ? json({ error: { code: 400, message: 'tools not supported' } }, 400) : ok('{"city":"Astana","year":1997}')));
  const r2 = await new OpenRouterClient(baseCfg(), f2).probeCapabilities();
  assert.equal(r2.toolCalling.status, 'unsupported');
  assert.equal(r2.structuredOutputs.status, 'supported');
});

test('ADAL chat handler works through OpenRouter (greeting once, system prompt)', async () => {
  const cfg = readAIConfig({ OPENROUTER_API_KEY: 'sk-or-test' });
  assert.ok(cfg);
  const calls: Call[] = [];
  const r = await chat({ messages: [{ role: 'user', content: 'Мне требуют деньги за оценку. Что делать?' }] }, { config: cfg, fetchImpl: mockFetch(() => ok('### Как я понимаю ситуацию\nТекст'), calls) });
  assert.equal(r.status, 200);
  assert.ok(String(r.body.reply).startsWith('Привет! Я — ADAL, твой цифровой помощник. 👋'));
  const msgs = calls[0].body.messages as { role: string; content: string }[];
  assert.equal(msgs[0].role, 'system');
  assert.match(msgs[0].content, /You are ADAL AI/);
  const limited = await chat({ messages: [{ role: 'user', content: 'Сәлем' }] }, { config: cfg, fetchImpl: mockFetch(() => json({ error: { code: 429, message: 'free-models-per-day' } }, 429)) });
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, 'free_limit');
});

test('parseRetryAfter: seconds and HTTP-date', () => {
  assert.equal(parseRetryAfter('3'), 3000);
  assert.equal(parseRetryAfter(new Date(Date.now() + 5000).toUTCString(), Date.now()) !== null, true);
  assert.equal(parseRetryAfter(null), null);
});
