import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  /** Public anon / publishable key. Safe to use server-side; RLS restricts it to INSERT on feedback. */
  key: string;
}

const PLACEHOLDER = /^(replace|your|xxx|placeholder|changeme|<)/i;
const bad = (v?: string) => !v || !v.trim() || PLACEHOLDER.test(v.trim());

/**
 * Reads Supabase settings from server-side env (no VITE_ prefix on purpose: the browser never talks
 * to Supabase directly). Returns null when not configured => feedback stays local-only, clearly labelled.
 * The service-role key is intentionally NOT used: no ADAL feature needs elevated permissions.
 */
export function readSupabaseConfig(env: NodeJS.ProcessEnv = process.env): SupabaseConfig | null {
  const url = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (bad(url) || bad(key)) return null;
  if (!/^https:\/\/[^\s/]+/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) return null;
  return { url, key };
}

export function missingSupabaseConfig(env: NodeJS.ProcessEnv = process.env): string[] {
  if (readSupabaseConfig(env)) return [];
  const m: string[] = [];
  if (bad(env.SUPABASE_URL)) m.push('SUPABASE_URL');
  if (bad(env.SUPABASE_ANON_KEY) && bad(env.SUPABASE_PUBLISHABLE_KEY)) m.push('SUPABASE_ANON_KEY');
  if (!m.length) m.push('SUPABASE_URL');
  return m;
}

let cached: { key: string; client: SupabaseClient } | null = null;

export function getSupabase(cfg: SupabaseConfig, fetchImpl?: typeof fetch): SupabaseClient {
  if (!fetchImpl && cached && cached.key === `${cfg.url}|${cfg.key}`) return cached.client;
  const client = createClient(cfg.url, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: fetchImpl ? { fetch: fetchImpl } : undefined,
  });
  if (!fetchImpl) cached = { key: `${cfg.url}|${cfg.key}`, client };
  return client;
}

export interface FeedbackRow {
  category: string;
  message: string;
  contact_email: string | null;
  lang: 'ru' | 'kk';
}

export type StoreError = 'storage_unavailable' | 'storage_rejected';

/**
 * Inserts one feedback row. Uses return=minimal (no `.select()`): anonymous roles have no SELECT
 * permission by design, so nobody — including this server — can read feedback back with the public key.
 */
export async function insertFeedback(cfg: SupabaseConfig, row: FeedbackRow, fetchImpl?: typeof fetch): Promise<{ ok: true } | { ok: false; error: StoreError }> {
  try {
    const { error, status } = await getSupabase(cfg, fetchImpl).from('feedback').insert(row);
    if (!error) return { ok: true };
    // Log only the Postgres/PostgREST code, never the row content.
    console.error(`[supabase] feedback insert failed: HTTP ${status} ${error.code ?? ''}`.trim());
    return { ok: false, error: status >= 400 && status < 500 ? 'storage_rejected' : 'storage_unavailable' };
  } catch {
    console.error('[supabase] feedback insert failed: network');
    return { ok: false, error: 'storage_unavailable' };
  }
}
