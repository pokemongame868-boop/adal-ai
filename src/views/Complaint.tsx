import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, Copy, ExternalLink, FilePlus2, Loader2, MessagesSquare, RefreshCw, Wand2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { ApiError, copyText, draftComplaint } from '../lib/api';
import type { Route } from '../lib/router';
import { SectionHeader } from '../components/SectionHeader';

interface Props {
  conversationText: string;
  seed: string | null;
  clearSeed: () => void;
  navigate: (r: Route, s?: string) => void;
}

const MAX = 8000;

export function Complaint({ conversationText, seed, clearSeed, navigate }: Props) {
  const { t, lang, f } = useI18n();
  const c = t.complaint;
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState('');
  const [checklist, setChecklist] = useState<string[]>([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [noChatNote, setNoChatNote] = useState(false);

  useEffect(() => {
    if (seed) {
      setDescription(seed.slice(0, MAX));
      clearSeed();
    }
  }, [seed, clearSeed]);

  const generate = async () => {
    const d = description.trim();
    if (d.length < 20) {
      setError('description_too_short');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await draftComplaint(d, lang);
      setDraft(res.draft);
      setChecklist(res.checklist);
      setDemo(res.demo);
      requestAnimationFrame(() => document.getElementById('draft-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'generic');
    } finally {
      setLoading(false);
    }
  };

  const fillFromChat = () => {
    if (!conversationText.trim()) {
      setNoChatNote(true);
      return;
    }
    setNoChatNote(false);
    setDescription(conversationText.slice(0, MAX));
  };

  const copy = async () => {
    const ok = await copyText(draft);
    setCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setCopied(null), 2000);
  };

  const newDraft = () => {
    setDraft('');
    setChecklist([]);
    setDescription('');
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const errText = error ? ((t.errors as Record<string, string>)[error] ?? t.errors.generic) : null;

  return (
    <div className="container-x py-12 sm:py-16">
      <SectionHeader as="h1" eyebrow={c.eyebrow} title={c.title} lead={c.lead} />

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="card p-5 sm:p-7">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="complaint-src" className="label mb-0">{c.sourceLabel}</label>
              <button type="button" onClick={fillFromChat} className="btn-ghost btn-sm">
                <MessagesSquare size={15} /> {c.useChat}
              </button>
            </div>
            <p className="mb-3 text-xs text-navy-500">{noChatNote ? c.noChat : c.useChatHint}</p>
            <textarea
              id="complaint-src"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX))}
              rows={7}
              placeholder={c.sourcePlaceholder}
              className="field resize-y leading-relaxed"
            />
            <div className="mt-1.5 text-right text-[11.5px] text-navy-500">{f(t.chat.counter, { n: description.length, max: MAX })}</div>
            {errText && (
              <p className="mt-3 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {errText}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={generate} disabled={loading} className="btn-primary">
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Wand2 size={17} />}
                {loading ? c.generating : c.generate}
              </button>
            </div>
          </div>

          <div id="draft-result" className="card p-5 sm:p-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-serif text-xl font-semibold">{c.resultTitle}</h2>
                {draft && (
                  <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${demo ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-paper-2 text-navy-600'}`}>
                    {demo ? c.demoBadge : c.liveBadge}
                  </span>
                )}
              </div>
              {draft && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={copy} className="btn-accent btn-sm">
                    {copied === 'ok' ? <Check size={15} /> : <Copy size={15} />} {copied === 'ok' ? c.copied : c.copy}
                  </button>
                  <button type="button" onClick={generate} disabled={loading} className="btn-ghost btn-sm">
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> {c.regenerate}
                  </button>
                  <button type="button" onClick={newDraft} className="btn-ghost btn-sm">
                    <FilePlus2 size={15} /> {c.newDraft}
                  </button>
                </div>
              )}
            </div>
            {copied === 'fail' && <p className="mb-3 text-sm text-red-800" role="alert">{t.errors.copy}</p>}
            {draft ? (
              <>
                <p className="mb-2 text-xs text-navy-500">{c.editHint}</p>
                <label htmlFor="draft-text" className="sr-only">{c.resultTitle}</label>
                <textarea id="draft-text" value={draft} onChange={(e) => setDraft(e.target.value)} rows={18} className="field resize-y font-serif text-[15.5px] leading-relaxed" />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-line bg-paper/60 px-5 py-12 text-center text-sm text-navy-500">{c.empty}</div>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          {checklist.length > 0 && (
            <div className="card animate-fade-up p-6">
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><ClipboardCheck size={18} className="text-emerald-700" /> {c.checklistTitle}</h3>
              <ul className="space-y-2.5 text-sm leading-relaxed text-navy-700">
                {checklist.map((item) => (
                  <li key={item} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />{item}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-sm leading-relaxed text-amber-900">
            <AlertTriangle size={18} className="mb-2" />
            {c.disclaimer}
          </div>
          <div className="card p-6">
            <h3 className="mb-1.5 font-semibold">{c.whereTitle}</h3>
            <p className="mb-4 text-sm leading-relaxed text-navy-600">{c.whereText}</p>
            <div className="flex flex-wrap gap-2">
              <a href="https://eotinish.kz/" target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">eotinish.kz <ExternalLink size={14} /></a>
              <button type="button" onClick={() => navigate('resources')} className="btn-ghost btn-sm">{t.nav.resources}</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
