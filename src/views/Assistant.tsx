import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, ArrowUp, Check, Copy, FileText, Info, Plus, RotateCcw, ShieldAlert } from 'lucide-react';
import { useI18n } from '../i18n';
import { MAX_MESSAGE, copyText, type Health, type UIMessage } from '../lib/api';
import type { ChatApi } from '../hooks/useChat';
import { Markdown } from '../components/Markdown';
import { ShieldMark } from '../components/Logo';

interface Props {
  chat: ChatApi;
  health: Health | null | 'error';
  pendingPrompt: string | null;
  clearPending: () => void;
  onDraft: () => void;
}

function ModeBadge({ health }: { health: Props['health'] }) {
  const { t } = useI18n();
  if (health === null)
    return <span className="inline-flex items-center gap-1.5 text-xs text-navy-500"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-navy-300" />{t.chat.modeChecking}</span>;
  const live = health !== 'error' && health.mode === 'live';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${live ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {live ? t.chat.modeLive : t.chat.modeDemo}
    </span>
  );
}

function AssistantMessage({ m, isLast, onDraft }: { m: UIMessage; isLast: boolean; onDraft: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(m.content)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <div className="animate-fade-up flex gap-3">
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white">
        <ShieldMark className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="card rounded-tl-md px-5 py-4">
          <Markdown text={m.content} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${m.demo ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-paper-2 text-navy-600'}`}>
            {m.demo ? t.chat.demoBadge : t.chat.liveBadge}
          </span>
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-navy-500 hover:bg-white hover:text-navy-900">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t.chat.copied : t.chat.copy}
          </button>
          {isLast && (
            <button type="button" onClick={onDraft} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100">
              <FileText size={13} /> {t.chat.draft}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Assistant({ chat, health, pendingPrompt, clearPending, onDraft }: Props) {
  const { t, f } = useI18n();
  const [input, setInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const consumed = useRef<string | null>(null);
  const { messages, status, error, send, retry, reset } = chat;
  const loading = status === 'loading';
  const tooLong = input.length > MAX_MESSAGE;

  // Auto-send a scenario chosen on the landing page (guarded against StrictMode double effects).
  useEffect(() => {
    if (!pendingPrompt || consumed.current === pendingPrompt) return;
    consumed.current = pendingPrompt;
    if (!loading && send(pendingPrompt)) clearPending();
    else {
      setInput(pendingPrompt);
      clearPending();
    }
  }, [pendingPrompt, loading, send, clearPending]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, status]);

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  }, [input]);

  const submit = () => {
    if (tooLong || !input.trim()) return;
    if (send(input)) setInput('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const newChat = () => {
    if (messages.length && !confirming) {
      setConfirming(true);
      return;
    }
    reset();
    setInput('');
    setConfirming(false);
    taRef.current?.focus();
  };

  const examples = t.scenarios.items.map((s) => s.prompt);
  const isDemo = health === 'error' || (health !== null && health.mode === 'demo');
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <div className="container-x grid gap-6 py-6 lg:grid-cols-[280px_1fr] lg:py-8">
      {/* Sidebar */}
      <aside className="hidden space-y-5 lg:block">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 text-white"><ShieldMark className="h-6 w-6" /></span>
            <div>
              <div className="font-serif text-lg font-semibold">{t.chat.title}</div>
              <ModeBadge health={health} />
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-navy-600">{t.chat.subtitle}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-sm leading-relaxed text-amber-900">
          <ShieldAlert size={18} className="mb-2" />
          {t.chat.privacy}
        </div>
        <button type="button" onClick={onDraft} className="btn-ghost w-full">
          <FileText size={16} /> {t.chat.draft}
        </button>
      </aside>

      {/* Chat panel */}
      <section className="card flex h-[calc(100dvh-68px-3rem)] min-h-[480px] flex-col overflow-hidden lg:h-[calc(100dvh-68px-4rem)]" aria-label={t.chat.title}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white"><ShieldMark className="h-4.5 w-4.5" /></span>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-semibold">{t.chat.title}</div>
              <ModeBadge health={health} />
            </div>
          </div>
          <div className="hidden text-sm text-navy-500 lg:block">{t.chat.subtitle}</div>
          <div className="flex items-center gap-2">
            {confirming ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="hidden text-navy-600 sm:inline">{t.chat.newChatConfirm}</span>
                <button type="button" className="btn-primary btn-sm" onClick={newChat}>{t.chat.confirmYes}</button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirming(false)}>{t.chat.cancel}</button>
              </div>
            ) : (
              <button type="button" className="btn-ghost btn-sm whitespace-nowrap" onClick={newChat} disabled={!messages.length && !input} aria-label={t.chat.newChat}>
                <Plus size={15} /> <span className="hidden sm:inline">{t.chat.newChat}</span>
              </button>
            )}
          </div>
        </div>

        {isDemo && (
          <div className="flex gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] leading-snug text-amber-900 sm:px-5" role="status">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>
              {t.chat.demoBanner}
              {health !== 'error' && health?.missing?.length ? ` ${f(t.chat.demoMissing, { vars: health.missing.join(', ') })}` : ''}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6" aria-live="polite">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center py-6 text-center">
              <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldMark className="h-8 w-8 text-navy-900" /></span>
              <h1 className="font-serif text-2xl font-semibold">{t.chat.emptyTitle}</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-navy-600">{t.chat.emptyText}</p>
              <div className="mt-7 w-full text-left">
                <div className="mb-2.5 text-xs font-semibold tracking-[0.08em] text-navy-500 uppercase">{t.chat.examples}</div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {examples.map((ex) => (
                    <button key={ex} type="button" onClick={() => send(ex)} disabled={loading} className="rounded-xl border border-line bg-paper/60 px-4 py-3 text-left text-sm leading-snug text-navy-800 transition hover:border-emerald-300 hover:bg-emerald-50/40">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-6 flex gap-2 rounded-xl bg-paper-2 px-4 py-3 text-left text-xs leading-relaxed text-navy-600 lg:hidden">
                <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-700" /> {t.chat.privacy}
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="animate-fade-up flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-navy-900 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-white">
                      <span className="sr-only">{t.chat.you}: </span>
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <AssistantMessage key={m.id} m={m} isLast={m.id === lastAssistantId && !loading} onDraft={onDraft} />
                ),
              )}
              {loading && (
                <div className="flex items-center gap-3" role="status">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-white"><ShieldMark className="h-4.5 w-4.5" /></span>
                  <div className="card flex items-center gap-3 rounded-tl-md px-4 py-3 text-sm text-navy-600">
                    <span className="flex gap-1" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="h-1.5 w-1.5 animate-dot rounded-full bg-emerald-600" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                    {t.chat.thinking}
                  </div>
                </div>
              )}
              {status === 'error' && error && (
                <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between" role="alert">
                  <span className="flex gap-2"><AlertTriangle size={17} className="mt-0.5 shrink-0" /> {(t.errors as Record<string, string>)[error] ?? t.errors.generic}</span>
                  <button type="button" onClick={retry} className="btn btn-sm shrink-0 border border-red-200 bg-white text-red-900 hover:bg-red-100">
                    <RotateCcw size={14} /> {t.chat.retry}
                  </button>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          className="border-t border-line bg-paper/60 p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className={`mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-white p-2 transition focus-within:ring-4 ${tooLong ? 'border-red-300 focus-within:ring-red-100' : 'border-line focus-within:border-emerald-500 focus-within:ring-emerald-100'}`}>
            <label htmlFor="chat-input" className="sr-only">{t.chat.placeholder}</label>
            <textarea
              id="chat-input"
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={2}
              placeholder={t.chat.placeholder}
              enterKeyHint="send"
              autoComplete="off"
              className="max-h-[220px] min-h-[52px] flex-1 resize-none bg-transparent px-3 py-2 text-[16px] leading-relaxed text-navy-900 outline-none placeholder:text-navy-500"
            />
            <button type="submit" disabled={loading || !input.trim() || tooLong} aria-label={loading ? t.chat.sending : t.chat.send} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white transition hover:bg-emerald-700 disabled:bg-navy-200">
              <ArrowUp size={20} />
            </button>
          </div>
          <div className="mx-auto mt-1.5 flex max-w-3xl justify-between px-1 text-[11.5px] text-navy-500">
            <span className="hidden sm:inline">{t.chat.hint}</span>
            <span className={tooLong ? 'font-medium text-red-700' : ''}>
              {tooLong ? f(t.chat.tooLong, { max: MAX_MESSAGE }) : f(t.chat.counter, { n: input.length, max: MAX_MESSAGE })}
            </span>
          </div>
        </form>
      </section>
    </div>
  );
}
