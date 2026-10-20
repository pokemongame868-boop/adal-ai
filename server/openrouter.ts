/**
 * OpenRouter integration via the official `openai` SDK (only baseURL + apiKey differ).
 * Default model: MiniMax M3.1 Flash (free) — `minimax/minimax-m3.1-flash:free`.
 *
 * - async/await everywhere, strict types, no `any`
 * - per-attempt timeout, retry with delay on 429 / 5xx (honours Retry-After), no SDK auto-retries
 * - free-model limit detection (OpenRouter: 20 req/min, 50 or 1000 req/day) => `free_limit`
 * - bounded concurrency (semaphore + bounded queue)
 * - tool calling / structured outputs are NOT assumed: `probeCapabilities()` checks them with
 *   separate test requests; ADAL's chat uses neither.
 * The API key is read from OPENROUTER_API_KEY, never logged and never sent to the browser.
 */
import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from 'openai';
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { AIError, type AIErrorCode } from './errors.ts';
import { Semaphore, SemaphoreFullError, SemaphoreTimeoutError } from './semaphore.ts';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_DEFAULT_MODEL = 'minimax/minimax-m3.1-flash:free';

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  /** Per-attempt request timeout. */
  timeoutMs: number;
  /** Extra attempts after the first one, only for 429 / 5xx / connection errors. */
  maxRetries: number;
  /** Upper bound for a single back-off; a longer Retry-After is not waited for. */
  maxRetryDelayMs: number;
  /** Max simultaneous requests to OpenRouter from this process. */
  maxConcurrency: number;
  /** Max requests waiting for a slot; beyond that new requests fail fast with `busy`. */
  maxQueue: number;
  maxTokens: number;
  /** undefined => `temperature` is not sent. */
  temperature: number | undefined;
  /** Optional OpenRouter app attribution (HTTP-Referer + X-OpenRouter-Title). */
  appUrl: string | undefined;
  appTitle: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type Lang = 'ru' | 'kk';

const PLACEHOLDER = /^(replace|your|xxx|placeholder|changeme|<)/i;
const isBad = (v: string | undefined): boolean => !v || !v.trim() || PLACEHOLDER.test(v.trim());

function positiveInt(v: string | undefined, fallback: number, max: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}

function nonNegativeInt(v: string | undefined, fallback: number, max: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, max) : fallback;
}

function parseTemperature(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return 0.4;
  if (v.trim().toLowerCase() === 'default') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 1.5) : 0.4;
}

/** Reads OpenRouter settings from server-side env. Returns null when OPENROUTER_API_KEY is absent. */
export function readOpenRouterConfig(env: NodeJS.ProcessEnv = process.env): OpenRouterConfig | null {
  const apiKey = env.OPENROUTER_API_KEY;
  if (isBad(apiKey) || apiKey === undefined) return null;
  const baseUrl = (env.OPENROUTER_BASE_URL || OPENROUTER_BASE_URL).trim().replace(/\/+$/, '');
  if (!/^https:\/\//.test(baseUrl)) return null;
  const model = isBad(env.OPENROUTER_MODEL) ? OPENROUTER_DEFAULT_MODEL : (env.OPENROUTER_MODEL ?? '').trim();
  const appUrl = (env.OPENROUTER_APP_URL || '').trim();
  return {
    apiKey: apiKey.trim(),
    model,
    baseUrl,
    timeoutMs: positiveInt(env.OPENROUTER_TIMEOUT_MS, 45_000, 300_000),
    maxRetries: nonNegativeInt(env.OPENROUTER_MAX_RETRIES, 2, 5),
    maxRetryDelayMs: positiveInt(env.OPENROUTER_MAX_RETRY_DELAY_MS, 10_000, 60_000),
    maxConcurrency: positiveInt(env.OPENROUTER_MAX_CONCURRENCY, 2, 20),
    maxQueue: nonNegativeInt(env.OPENROUTER_MAX_QUEUE, 20, 500),
    // MiniMax M3.1 is a reasoning model; reasoning tokens count against max_tokens.
    maxTokens: positiveInt(env.OPENROUTER_MAX_TOKENS, 3000, 32_000),
    temperature: parseTemperature(env.OPENROUTER_TEMPERATURE),
    appUrl: /^https?:\/\//.test(appUrl) ? appUrl : undefined,
    appTitle: (env.OPENROUTER_APP_TITLE || 'ADAL AI').trim().slice(0, 80),
  };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry-After as milliseconds: delta-seconds or HTTP-date. */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

const RETRYABLE_STATUS: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504]);

/** OpenRouter's free-model daily cap (50/day, or 1000/day with ≥10 credits) cannot be waited out. */
export function isDailyFreeLimit(err: APIError, now: number = Date.now()): boolean {
  if (err.status !== 429) return false;
  if (/per[- ]?day|daily|free-models-per-day/i.test(err.message)) return true;
  const remaining = err.headers?.get('x-ratelimit-remaining');
  const reset = Number(err.headers?.get('x-ratelimit-reset'));
  return remaining === '0' && Number.isFinite(reset) && reset - now > 120_000;
}

/** Maps any thrown value to an AIError. Messages contain no request content or secrets. */
export function toAIError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof SemaphoreFullError || e instanceof SemaphoreTimeoutError) return new AIError('busy', e.message);
  if (e instanceof APIConnectionTimeoutError) return new AIError('timeout', 'OpenRouter timed out');
  if (e instanceof APIUserAbortError) return new AIError('timeout', 'Request aborted');
  if (e instanceof APIConnectionError) return new AIError('upstream', 'Network error while contacting OpenRouter');
  if (e instanceof APIError) {
    const s = e.status;
    const map = (code: AIErrorCode, msg: string): AIError => new AIError(code, msg, s);
    if (s === 429) return isDailyFreeLimit(e) ? map('free_limit', 'Free-model daily limit reached') : map('rate_limited', 'OpenRouter rate limit');
    if (s === 401) return map('auth', 'OpenRouter rejected the API key');
    if (s === 402) return map('quota', 'OpenRouter credits insufficient');
    if (s === 403) return map('bad_request', 'OpenRouter refused the request (permissions or moderation)');
    if (s === 404) return map('model_unavailable', 'Model not found on OpenRouter');
    if (s === 400 || s === 413 || s === 422) return map('bad_request', 'OpenRouter rejected request parameters');
    if (s === 408) return map('timeout', 'OpenRouter request timeout');
    if (s === 503) return map('model_unavailable', 'No provider available for this model right now');
    return map('upstream', `OpenRouter HTTP ${s ?? 'error'}`);
  }
  return new AIError('upstream', 'Unexpected error while contacting OpenRouter');
}

/** Returns the delay before the next attempt, or null if the error must not be retried. */
export function retryDelayMs(e: unknown, attempt: number, cfg: Pick<OpenRouterConfig, 'maxRetryDelayMs'>, random: () => number = Math.random): number | null {
  let fromHeader: number | null = null;
  if (e instanceof APIConnectionTimeoutError || e instanceof APIUserAbortError) return null; // don't multiply latency
  if (e instanceof APIError && !(e instanceof APIConnectionError)) {
    if (e.status === undefined || !RETRYABLE_STATUS.has(e.status)) return null;
    if (isDailyFreeLimit(e)) return null;
    fromHeader = parseRetryAfter(e.headers?.get('retry-after'));
  } else if (!(e instanceof APIConnectionError)) {
    return null;
  }
  if (fromHeader !== null) return fromHeader <= cfg.maxRetryDelayMs ? fromHeader : null;
  const backoff = 1000 * 2 ** attempt + Math.floor(random() * 250);
  return Math.min(backoff, cfg.maxRetryDelayMs);
}

function extractContent(completion: ChatCompletion): string {
  // OpenRouter may answer HTTP 200 with an `error` object and no choices.
  const choices: ChatCompletion['choices'] | undefined = Array.isArray(completion.choices) ? completion.choices : undefined;
  const choice = choices?.[0];
  if (!choice) throw new AIError('invalid_response', 'OpenRouter returned no choices');
  const finish: string | null = choice.finish_reason;
  if (finish === 'error') throw new AIError('upstream', 'Model reported an error while generating');
  const content = choice.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new AIError('invalid_response', finish === 'length' ? 'Output budget exhausted before an answer' : 'Empty model output');
  }
  return content.trim();
}

export type ProbeStatus = 'supported' | 'unsupported' | 'inconclusive';

export interface CapabilityResult {
  status: ProbeStatus;
  detail: string;
}

export interface CapabilityReport {
  model: string;
  checkedAt: string;
  /** `supported_parameters` from OpenRouter's public model list (informational only). */
  advertised: string[] | null;
  toolCalling: CapabilityResult;
  structuredOutputs: CapabilityResult;
}

const PROBE_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_server_time',
    description: 'Returns the current server time for an IANA timezone.',
    parameters: {
      type: 'object',
      properties: { timezone: { type: 'string', description: 'IANA timezone, e.g. Asia/Almaty' } },
      required: ['timezone'],
      additionalProperties: false,
    },
  },
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export class OpenRouterClient {
  private readonly client: OpenAI;
  private readonly semaphore: Semaphore;
  private capabilities: Promise<CapabilityReport> | null = null;

  constructor(
    readonly config: OpenRouterConfig,
    private readonly fetchImpl?: typeof fetch,
  ) {
    const defaultHeaders: Record<string, string> = {};
    if (config.appUrl) {
      defaultHeaders['HTTP-Referer'] = config.appUrl;
      defaultHeaders['X-OpenRouter-Title'] = config.appTitle;
    }
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      maxRetries: 0, // retries are handled below so we can classify free-model limits
      defaultHeaders,
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    });
    this.semaphore = new Semaphore(config.maxConcurrency, config.maxQueue);
  }

  get inFlight(): number {
    return this.semaphore.inFlight;
  }

  /** One concurrency slot for the whole call including retries; retries only on 429 / 5xx. */
  private async complete(body: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion> {
    return this.semaphore.run(this.config.timeoutMs, async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await this.client.chat.completions.create(body);
        } catch (e) {
          const delay = attempt < this.config.maxRetries ? retryDelayMs(e, attempt, this.config) : null;
          if (delay === null) throw toAIError(e);
          await sleep(delay);
        }
      }
    });
  }

  private baseBody(messages: ChatCompletionMessageParam[]): ChatCompletionCreateParamsNonStreaming {
    return {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens,
      ...(this.config.temperature !== undefined ? { temperature: this.config.temperature } : {}),
    };
  }

  /** Multi-turn chat with a server-side system prompt. Returns the assistant text. */
  async chat(system: string, turns: readonly ChatTurn[]): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...turns.map((t): ChatCompletionMessageParam => (t.role === 'user' ? { role: 'user', content: t.content } : { role: 'assistant', content: t.content })),
    ];
    try {
      return extractContent(await this.complete(this.baseBody(messages)));
    } catch (e) {
      throw toAIError(e);
    }
  }

  /** Single prompt -> answer. */
  async ask(prompt: string, system?: string): Promise<string> {
    const text = prompt.trim();
    if (!text) throw new AIError('bad_request', 'Prompt is empty');
    if (text.length > 16_000) throw new AIError('bad_request', 'Prompt is too long');
    return this.chat(system ?? 'You are a helpful assistant. Answer concisely.', [{ role: 'user', content: text }]);
  }

  /** Probes once per client and caches the result. Uses 2 requests from the free-model quota. */
  getCapabilities(): Promise<CapabilityReport> {
    this.capabilities ??= this.probeCapabilities().catch((e: unknown) => {
      this.capabilities = null;
      throw e;
    });
    return this.capabilities;
  }

  async probeCapabilities(): Promise<CapabilityReport> {
    const [advertised, toolCalling, structuredOutputs] = await Promise.all([
      this.advertisedParameters(),
      this.probeToolCalling(),
      this.probeStructuredOutputs(),
    ]);
    return { model: this.config.model, checkedAt: new Date().toISOString(), advertised, toolCalling, structuredOutputs };
  }

  private async advertisedParameters(): Promise<string[] | null> {
    try {
      const res = await (this.fetchImpl ?? fetch)(`${this.config.baseUrl}/models`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const json: unknown = await res.json();
      if (!isRecord(json) || !Array.isArray(json.data)) return null;
      const entry: unknown = json.data.find((m: unknown) => isRecord(m) && m.id === this.config.model);
      if (!isRecord(entry) || !Array.isArray(entry.supported_parameters)) return null;
      return entry.supported_parameters.filter((p: unknown): p is string => typeof p === 'string');
    } catch {
      return null;
    }
  }

  private inconclusiveOrUnsupported(e: unknown, feature: string): CapabilityResult {
    const err = toAIError(e);
    if (err.code === 'bad_request' || err.code === 'model_unavailable')
      return { status: 'unsupported', detail: `${feature} request rejected (HTTP ${err.status ?? '?'})` };
    return { status: 'inconclusive', detail: `${feature} probe failed: ${err.code}` };
  }

  private async probeToolCalling(): Promise<CapabilityResult> {
    const body: ChatCompletionCreateParamsNonStreaming = {
      ...this.baseBody([
        { role: 'user', content: 'Call the get_server_time tool for timezone "Asia/Almaty". Do not answer with text.' },
      ]),
      tools: [PROBE_TOOL],
      tool_choice: 'auto',
    };
    try {
      const completion = await this.complete(body);
      const calls = completion.choices?.[0]?.message?.tool_calls ?? [];
      for (const call of calls) {
        if (call.type !== 'function' || call.function.name !== 'get_server_time') continue;
        try {
          const args: unknown = JSON.parse(call.function.arguments);
          if (isRecord(args) && typeof args.timezone === 'string')
            return { status: 'supported', detail: `tool_call returned with timezone=${args.timezone.slice(0, 40)}` };
        } catch {
          return { status: 'unsupported', detail: 'tool_call arguments were not valid JSON' };
        }
      }
      return { status: 'unsupported', detail: 'Model answered without a valid tool_call' };
    } catch (e) {
      return this.inconclusiveOrUnsupported(e, 'Tool calling');
    }
  }

  private async probeStructuredOutputs(): Promise<CapabilityResult> {
    const body: ChatCompletionCreateParamsNonStreaming = {
      ...this.baseBody([{ role: 'user', content: 'What is the capital of Kazakhstan and in which year did it become the capital?' }]),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'capital_probe',
          strict: true,
          schema: {
            type: 'object',
            properties: { city: { type: 'string' }, year: { type: 'integer' } },
            required: ['city', 'year'],
            additionalProperties: false,
          },
        },
      },
    };
    try {
      const raw = extractContent(await this.complete(body));
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { status: 'unsupported', detail: 'Output was not pure JSON (schema not enforced)' };
      }
      const keys = isRecord(parsed) ? Object.keys(parsed).sort().join(',') : '';
      if (isRecord(parsed) && typeof parsed.city === 'string' && Number.isInteger(parsed.year) && keys === 'city,year')
        return { status: 'supported', detail: 'Output matched the JSON schema exactly' };
      return { status: 'unsupported', detail: 'JSON did not match the requested schema' };
    } catch (e) {
      return this.inconclusiveOrUnsupported(e, 'Structured outputs');
    }
  }
}

const clients = new Map<string, OpenRouterClient>();

/** Shared client per configuration, so the concurrency limit applies process-wide. */
export function getOpenRouterClient(cfg: OpenRouterConfig, fetchImpl?: typeof fetch): OpenRouterClient {
  if (fetchImpl) return new OpenRouterClient(cfg, fetchImpl);
  const key = `${cfg.baseUrl}|${cfg.model}|${cfg.apiKey.slice(-6)}|${cfg.maxConcurrency}`;
  let client = clients.get(key);
  if (!client) {
    client = new OpenRouterClient(cfg);
    clients.set(key, client);
  }
  return client;
}

/**
 * ask(prompt) -> answer, using OPENROUTER_* env settings.
 * Throws AIError; use `describeError(err, lang)` for a user-facing message.
 */
export async function ask(prompt: string): Promise<string> {
  const cfg = readOpenRouterConfig();
  if (!cfg) throw new AIError('auth', 'OPENROUTER_API_KEY is not configured');
  return getOpenRouterClient(cfg).ask(prompt);
}

const USER_MESSAGES: Record<Lang, Record<AIErrorCode, string>> = {
  ru: {
    free_limit: 'Дневной лимит бесплатной модели исчерпан. Попробуйте завтра или подключите платную модель.',
    rate_limited: 'Слишком много запросов к бесплатной модели. Подождите минуту и повторите.',
    busy: 'Сервис сейчас перегружен запросами. Попробуйте через минуту.',
    timeout: 'Модель отвечает слишком долго. Попробуйте ещё раз.',
    auth: 'Ключ OpenRouter не настроен или недействителен.',
    quota: 'На аккаунте OpenRouter недостаточно кредитов.',
    model_unavailable: 'Модель сейчас недоступна. Попробуйте позже.',
    bad_request: 'Запрос отклонён. Попробуйте переформулировать.',
    upstream: 'AI-сервис временно недоступен. Попробуйте позже.',
    invalid_response: 'Модель вернула пустой или некорректный ответ. Попробуйте ещё раз.',
  },
  kk: {
    free_limit: 'Тегін модельдің күндік лимиті таусылды. Ертең қайталаңыз немесе ақылы модельді қосыңыз.',
    rate_limited: 'Тегін модельге сұраулар тым көп. Бір минут күтіп, қайталаңыз.',
    busy: 'Сервис қазір сұраулармен жүктелген. Бір минуттан кейін көріңіз.',
    timeout: 'Модель тым ұзақ жауап беріп жатыр. Қайталап көріңіз.',
    auth: 'OpenRouter кілті бапталмаған немесе жарамсыз.',
    quota: 'OpenRouter аккаунтында кредит жеткіліксіз.',
    model_unavailable: 'Модель қазір қолжетімсіз. Кейінірек көріңіз.',
    bad_request: 'Сұрау қабылданбады. Басқаша жазып көріңіз.',
    upstream: 'AI-сервис уақытша қолжетімсіз. Кейінірек көріңіз.',
    invalid_response: 'Модель бос немесе қате жауап қайтарды. Қайталап көріңіз.',
  },
};

export function describeError(e: unknown, lang: Lang = 'ru'): string {
  return USER_MESSAGES[lang][toAIError(e).code];
}
