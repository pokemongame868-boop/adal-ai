import type { AIConfig } from './config.ts';
import { AIError } from './errors.ts';
import { getOpenRouterClient } from './openrouter.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export { AIError, type AIErrorCode } from './errors.ts';

/**
 * Minimal provider adapter. One function, two wire formats:
 *  - "openai": OpenAI-compatible POST {base}/chat/completions (used for AIHubMix, Bearer auth)
 *  - "anthropic": POST {base}/messages (legacy fallback)
 *
 * For OpenAI-compatible gateways, a 400 caused by an optional parameter the selected model does not
 * accept (AIHubMix passes most 400s through from the upstream vendor) is retried once without
 * `temperature` / `max_tokens`.
 */
export async function generate(cfg: AIConfig, system: string, messages: ChatMessage[], fetchImpl: typeof fetch = fetch): Promise<string> {
  if (cfg.provider === 'openrouter' && cfg.openrouter) {
    // Official openai SDK, own retry/back-off, semaphore and free-limit handling.
    return getOpenRouterClient(cfg.openrouter, fetchImpl === fetch ? undefined : fetchImpl).chat(system, messages);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    if (cfg.provider === 'anthropic') {
      const res = await fetchImpl(`${cfg.baseUrl}/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: cfg.maxTokens,
          ...(cfg.temperature !== undefined ? { temperature: cfg.temperature } : {}),
          system,
          messages,
        }),
      });
      return await readResult(cfg, res);
    }

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
    const base = { model: cfg.model, messages: [{ role: 'system', content: system }, ...messages] };
    const tuned = {
      ...base,
      max_tokens: cfg.maxTokens,
      ...(cfg.temperature !== undefined ? { temperature: cfg.temperature } : {}),
    };
    const call = (body: object) =>
      fetchImpl(`${cfg.baseUrl}/chat/completions`, { method: 'POST', signal: controller.signal, headers, body: JSON.stringify(body) });

    let res = await call(tuned);
    if (res.status === 400) {
      await res.body?.cancel().catch(() => {});
      res = await call(base);
    }
    return await readResult(cfg, res);
  } catch (e) {
    if (e instanceof AIError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new AIError('timeout', 'Provider timed out');
    throw new AIError('upstream', 'Network error while contacting provider');
  } finally {
    clearTimeout(timer);
  }
}

async function readResult(cfg: AIConfig, res: Response): Promise<string> {
  if (!res.ok) {
    // Read the error body only to classify it; never log or return it (may echo request data).
    let errText = '';
    try {
      errText = (await res.text()).slice(0, 2000);
    } catch {
      /* ignore */
    }
    const tid = /"tid"\s*:\s*"([\w-]{1,80})"/.exec(errText)?.[1];
    const s = res.status;
    if (s === 429) throw new AIError('rate_limited', 'Provider rate limit', s, tid);
    if (s === 401) throw new AIError('auth', 'Provider rejected credentials', s, tid);
    if (s === 403 && /insufficient_user_quota|balance/i.test(errText)) throw new AIError('quota', 'Provider balance insufficient', s, tid);
    if (s === 403) throw new AIError('auth', 'Provider denied access (key/model/IP restriction)', s, tid);
    if (s === 404 || (s === 503 && /model/i.test(errText))) throw new AIError('model_unavailable', 'Model id not available', s, tid);
    if (s === 503 && /rate limit/i.test(errText)) throw new AIError('rate_limited', 'Upstream provider throttling', s, tid);
    if (s === 400) throw new AIError('bad_request', 'Provider rejected request parameters', s, tid);
    throw new AIError('upstream', `Provider HTTP ${s}`, s, tid);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AIError('invalid_response', 'Provider returned non-JSON');
  }
  const text = extractText(cfg, data);
  if (!text) throw new AIError('invalid_response', 'Provider returned an empty or unexpected response');
  return text;
}

function extractText(cfg: AIConfig, data: unknown): string {
  const d = data as Record<string, unknown>;
  if (cfg.provider === 'anthropic') {
    const content = d?.content;
    if (!Array.isArray(content)) return '';
    return content
      .filter((b: { type?: string; text?: unknown }) => b?.type === 'text' && typeof b.text === 'string')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim();
  }
  const choices = d?.choices;
  if (!Array.isArray(choices) || !choices.length) return '';
  const msg = (choices[0] as { message?: { content?: unknown } })?.message?.content;
  if (typeof msg === 'string') return msg.trim();
  if (Array.isArray(msg)) return msg.map((p: { text?: string }) => p?.text || '').join('').trim();
  return '';
}
