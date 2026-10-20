import { readOpenRouterConfig, type OpenRouterConfig } from './openrouter.ts';

export type ProviderKind = 'openrouter' | 'openai' | 'anthropic';

export interface AIConfig {
  provider: ProviderKind;
  /** Human-readable provider label for /api/health and logs (never a secret). */
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  /** undefined => do not send `temperature` (some models only accept their default). */
  temperature: number | undefined;
  /** Present only when provider === 'openrouter' (retries, concurrency, attribution). */
  openrouter?: OpenRouterConfig;
}

/** AIHubMix: OpenAI-compatible gateway. Docs: https://docs.aihubmix.com/en/quick-start */
export const AIHUBMIX_BASE_URL = 'https://aihubmix.com/v1';

const PLACEHOLDER = /^(replace|your|xxx|placeholder|changeme|sk-\.\.\.|<)/i;
const bad = (v?: string) => !v || !v.trim() || PLACEHOLDER.test(v.trim());

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

function temp(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return 0.4;
  if (v.trim().toLowerCase() === 'default') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 1.5) : 0.4;
}

/**
 * Reads AI configuration from server-side env. Returns null (=> clearly labelled demo mode) when incomplete.
 *
 * Primary: AIHubMix — AIHUBMIX_ACCESS_KEY + AIHUBMIX_MODEL (AIHUBMIX_API_KEY is accepted as an alias,
 * matching AIHubMix's own docs). Legacy generic AI_* variables still work as a fallback so existing
 * deployments keep running.
 */
export function readAIConfig(env: NodeJS.ProcessEnv = process.env): AIConfig | null {
  // 1) OpenRouter (default when OPENROUTER_API_KEY is set; force with AI_PROVIDER=openrouter,
  //    skip with AI_PROVIDER=aihubmix).
  const choice = (env.AI_PROVIDER || '').trim().toLowerCase();
  if (choice === '' || choice === 'openrouter') {
    const or = readOpenRouterConfig(env);
    if (or) {
      return {
        provider: 'openrouter',
        label: 'openrouter',
        baseUrl: or.baseUrl,
        apiKey: or.apiKey,
        model: or.model,
        timeoutMs: or.timeoutMs,
        maxTokens: or.maxTokens,
        temperature: or.temperature,
        openrouter: or,
      };
    }
    if (choice === 'openrouter') return null;
  }

  // 2) AIHubMix
  const hubKey = env.AIHUBMIX_ACCESS_KEY || env.AIHUBMIX_API_KEY;
  const hubModel = env.AIHUBMIX_MODEL;
  const timeoutMs = num(env.AIHUBMIX_TIMEOUT_MS || env.AI_TIMEOUT_MS, 45000);
  const maxTokens = num(env.AIHUBMIX_MAX_TOKENS || env.AI_MAX_TOKENS, 1400);
  const temperature = temp(env.AIHUBMIX_TEMPERATURE ?? env.AI_TEMPERATURE);

  if (!bad(hubKey) || !bad(hubModel)) {
    if (bad(hubKey) || bad(hubModel)) return null;
    const baseUrl = (env.AIHUBMIX_BASE_URL || AIHUBMIX_BASE_URL).trim().replace(/\/+$/, '');
    if (!/^https:\/\//.test(baseUrl)) return null;
    return { provider: 'openai', label: 'aihubmix', baseUrl, apiKey: hubKey!.trim(), model: hubModel!.trim(), timeoutMs, maxTokens, temperature };
  }

  // Legacy fallback (generic OpenAI-compatible / Anthropic). Not needed for AIHubMix.
  const provider: ProviderKind = (env.AI_PROVIDER || 'openai').toLowerCase() === 'anthropic' ? 'anthropic' : 'openai';
  const apiKey = (env.AI_API_KEY || '').trim();
  const model = (env.AI_MODEL || '').trim();
  if (!env.AI_BASE_URL && !apiKey && !model) return null;
  const defaultBase = provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1';
  const baseUrl = (env.AI_BASE_URL || defaultBase).trim().replace(/\/+$/, '');
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(baseUrl);
  if (bad(model)) return null;
  if (bad(apiKey) && !isLocal) return null;
  if (baseUrl.includes('example.com')) return null;
  return { provider, label: provider === 'anthropic' ? 'anthropic' : 'openai-compatible', baseUrl, apiKey, model, timeoutMs, maxTokens, temperature };
}

/** Lists which variables are missing, without revealing values. */
export function missingConfig(env: NodeJS.ProcessEnv = process.env): string[] {
  if (readAIConfig(env)) return [];
  const choice = (env.AI_PROVIDER || '').trim().toLowerCase();
  const hubTouched = choice === 'aihubmix' || !bad(env.AIHUBMIX_ACCESS_KEY) || !bad(env.AIHUBMIX_API_KEY) || !bad(env.AIHUBMIX_MODEL);
  if (!hubTouched) return ['OPENROUTER_API_KEY'];
  const missing: string[] = [];
  if (bad(env.AIHUBMIX_ACCESS_KEY) && bad(env.AIHUBMIX_API_KEY)) missing.push('AIHUBMIX_ACCESS_KEY');
  if (bad(env.AIHUBMIX_MODEL)) missing.push('AIHUBMIX_MODEL');
  if (env.AIHUBMIX_BASE_URL && !/^https:\/\//.test(env.AIHUBMIX_BASE_URL.trim())) missing.push('AIHUBMIX_BASE_URL');
  return missing;
}
