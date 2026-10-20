import type { ChatMessage } from './provider.ts';

export const LIMITS = {
  messageChars: 4000,
  historyMessages: 24,
  totalChars: 30000,
  complaintChars: 8000,
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateChatBody(body: unknown): Result<{ messages: ChatMessage[] }> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'messages_required' };
  if (raw.length > 60) return { ok: false, error: 'too_many_messages' };
  const messages: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'invalid_message' };
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') return { ok: false, error: 'invalid_role' };
    if (typeof content !== 'string') return { ok: false, error: 'invalid_content' };
    const c = content.replaceAll('\u0000', '').trim();
    if (!c) return { ok: false, error: 'empty_message' };
    if (role === 'user' && c.length > LIMITS.messageChars) return { ok: false, error: 'message_too_long' };
    messages.push({ role, content: c.slice(0, LIMITS.messageChars * 2) });
  }
  if (messages[messages.length - 1].role !== 'user') return { ok: false, error: 'last_must_be_user' };
  return { ok: true, value: { messages } };
}

/** Keep the most recent messages within limits; history must start with a user turn. */
export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  let out = messages.slice(-LIMITS.historyMessages);
  let total = out.reduce((s, m) => s + m.content.length, 0);
  while (out.length > 1 && total > LIMITS.totalChars) {
    total -= out[0].content.length;
    out = out.slice(1);
  }
  while (out.length > 1 && out[0].role !== 'user') out = out.slice(1);
  return out;
}

export function validateComplaintBody(body: unknown): Result<{ description: string; lang: 'ru' | 'kk' }> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const { description, lang } = body as { description?: unknown; lang?: unknown };
  if (typeof description !== 'string') return { ok: false, error: 'description_required' };
  const d = description.replaceAll('\u0000', '').trim();
  if (d.length < 20) return { ok: false, error: 'description_too_short' };
  if (d.length > LIMITS.complaintChars) return { ok: false, error: 'description_too_long' };
  if (lang !== 'ru' && lang !== 'kk') return { ok: false, error: 'invalid_lang' };
  return { ok: true, value: { description: d, lang } };
}

export const FEEDBACK_CATEGORIES = ['idea', 'ux', 'content', 'bug', 'other'] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// 12-digit IIN-like numbers or 16-digit card-like numbers (same rule as the client form).
const SENSITIVE = /(\b\d{12}\b)|(\b(?:\d[ -]?){15}\d\b)/;

export interface FeedbackValue {
  category: (typeof FEEDBACK_CATEGORIES)[number];
  message: string;
  contact: string | null;
  lang: 'ru' | 'kk';
}

/** Server-side re-validation of the feedback form; never trust the browser. */
export function validateFeedbackBody(body: unknown): Result<FeedbackValue> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const { category, message, contact, lang } = body as Record<string, unknown>;
  if (typeof category !== 'string' || !(FEEDBACK_CATEGORIES as readonly string[]).includes(category))
    return { ok: false, error: 'invalid_category' };
  if (typeof message !== 'string') return { ok: false, error: 'invalid_message' };
  const m = message.replaceAll('\u0000', '').trim();
  if (m.length < 10 || m.length > 1000) return { ok: false, error: 'invalid_message' };
  if (SENSITIVE.test(m)) return { ok: false, error: 'sensitive_data' };
  let c: string | null = null;
  if (contact !== undefined && contact !== null && contact !== '') {
    if (typeof contact !== 'string') return { ok: false, error: 'invalid_contact' };
    const t = contact.trim();
    if (t && (t.length > 200 || !EMAIL.test(t))) return { ok: false, error: 'invalid_contact' };
    c = t || null;
  }
  if (lang !== 'ru' && lang !== 'kk') return { ok: false, error: 'invalid_lang' };
  return { ok: true, value: { category: category as FeedbackValue['category'], message: m, contact: c, lang } };
}
