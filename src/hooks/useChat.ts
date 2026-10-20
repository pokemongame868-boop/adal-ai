import { useCallback, useRef, useState } from 'react';
import { ApiError, sendChat, uid, type UIMessage } from '../lib/api';

export type ChatStatus = 'idle' | 'loading' | 'error';

/** Conversation lives only in memory for the current tab session. */
export function useChat() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const request = useCallback(async (history: UIMessage[]) => {
    const gen = ++generation.current;
    setStatus('loading');
    setError(null);
    try {
      const res = await sendChat(history.map(({ role, content }) => ({ role, content })));
      if (gen !== generation.current) return; // conversation was reset meanwhile
      setMessages((m) => [...m, { id: uid(), role: 'assistant', content: res.reply, demo: res.demo }]);
      setStatus('idle');
    } catch (e) {
      if (gen !== generation.current) return;
      setError(e instanceof ApiError ? e.code : 'generic');
      setStatus('error');
    }
  }, []);

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || status === 'loading') return false;
      const next = [...messages, { id: uid(), role: 'user' as const, content }];
      setMessages(next);
      void request(next);
      return true;
    },
    [messages, status, request],
  );

  const retry = useCallback(() => {
    if (status === 'loading' || !messages.length || messages[messages.length - 1].role !== 'user') return;
    void request(messages);
  }, [messages, status, request]);

  const reset = useCallback(() => {
    generation.current++;
    setMessages([]);
    setStatus('idle');
    setError(null);
  }, []);

  return { messages, status, error, send, retry, reset };
}

export type ChatApi = ReturnType<typeof useChat>;
