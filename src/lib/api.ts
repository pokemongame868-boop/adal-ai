export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UIMessage extends ChatMessage {
  id: string;
  demo?: boolean;
}

export interface Health {
  mode: 'live' | 'demo';
  provider: string | null;
  model: string | null;
  missing: string[];
  feedbackStorage?: 'supabase' | 'local';
  feedbackMissing?: string[];
}

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const TIMEOUT_MS = 60_000;

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new ApiError((e as Error)?.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.ok ? 'invalid_response' : 'network');
  }
  if (!res.ok) throw new ApiError(typeof data.error === 'string' ? data.error : 'generic');
  return data as T;
}

export async function getHealth(): Promise<Health> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new ApiError('network');
  return res.json();
}

export function sendChat(messages: ChatMessage[]) {
  return post<{ reply: string; lang: string; demo: boolean }>('/api/chat', { messages });
}

export function draftComplaint(description: string, lang: 'ru' | 'kk') {
  return post<{ draft: string; checklist: string[]; demo: boolean }>('/api/complaint', { description, lang });
}

export function submitFeedback(input: { category: string; message: string; contact: string; lang: 'ru' | 'kk' }) {
  return post<{ stored: boolean }>('/api/feedback', input);
}

export const MAX_MESSAGE = 4000;
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
