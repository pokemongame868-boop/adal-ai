import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Database, FlaskConical, Loader2, RotateCcw, Send } from 'lucide-react';
import { useI18n } from '../i18n';
import { validateFeedback, type FeedbackErrors } from '../lib/validation';
import { ApiError, submitFeedback, type Health } from '../lib/api';
import { SectionHeader } from '../components/SectionHeader';

type Done = null | 'local' | 'stored';

export function Feedback({ health }: { health: Health | null | 'error' }) {
  const { t, lang } = useI18n();
  const fb = t.feedback;
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [errors, setErrors] = useState<FeedbackErrors>({});
  const [done, setDone] = useState<Done>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Persist only when the server reports Supabase storage; otherwise stay an explicitly local demo.
  const storage = health !== null && health !== 'error' && health.feedbackStorage === 'supabase';

  const clear = () => {
    setCategory('');
    setMessage('');
    setContact('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const errs = validateFeedback({ category, message, contact });
    setErrors(errs);
    setSendError(null);
    if (Object.keys(errs).length) return;
    if (!storage) {
      // Demo only: nothing is sent or stored. Clear the values from memory.
      clear();
      setDone('local');
      return;
    }
    setSending(true);
    try {
      const res = await submitFeedback({ category, message: message.trim(), contact: contact.trim(), lang });
      if (!res.stored) throw new ApiError('storage_unavailable');
      clear();
      setDone('stored');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'generic';
      setSendError(code === 'rate_limited' ? fb.errRate : fb.errStore);
    } finally {
      setSending(false);
    }
  };

  const err = (k: keyof FeedbackErrors, text: string) =>
    errors[k] ? <p id={`err-${k}`} className="mt-1.5 text-sm text-red-700">{text}</p> : null;

  return (
    <div className="container-x py-12 sm:py-16">
      <SectionHeader as="h1" eyebrow={fb.eyebrow} title={fb.title} />
      <div className="mt-10 max-w-2xl">
        {storage ? (
          <p className="mb-5 flex gap-2.5 rounded-xl border border-navy-100 bg-paper-2 px-4 py-3 text-sm leading-relaxed text-navy-700">
            <Database size={17} className="mt-0.5 shrink-0" /> {fb.stored}
          </p>
        ) : (
          <p className="mb-5 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            <FlaskConical size={17} className="mt-0.5 shrink-0" /> {fb.demo}
          </p>
        )}
        {done ? (
          <div className="card animate-fade-up p-8 text-center" role="status">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-600" />
            <h2 className="font-serif text-2xl font-semibold">{done === 'stored' ? fb.storedTitle : fb.successTitle}</h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-navy-600">{done === 'stored' ? fb.storedText : fb.successText}</p>
            <button type="button" className="btn-ghost mt-6" onClick={() => { setDone(null); setErrors({}); }}>
              <RotateCcw size={16} /> {fb.again}
            </button>
          </div>
        ) : (
          <form className="card space-y-5 p-6 sm:p-8" onSubmit={submit} noValidate aria-busy={sending}>
            <div>
              <label htmlFor="fb-cat" className="label">{fb.category}</label>
              <select id="fb-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="field" aria-invalid={!!errors.category} aria-describedby={errors.category ? 'err-category' : undefined}>
                <option value="">{fb.choose}</option>
                {Object.entries(fb.categories).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              {err('category', fb.errCategory)}
            </div>
            <div>
              <label htmlFor="fb-msg" className="label">{fb.message}</label>
              <textarea id="fb-msg" value={message} onChange={(e) => setMessage(e.target.value.slice(0, 1200))} rows={5} placeholder={fb.messagePlaceholder} className="field resize-y" aria-invalid={!!(errors.message || errors.sensitive)} />
              <div className="mt-1 text-right text-[11.5px] text-navy-500">{message.length} / 1000</div>
              {err('message', fb.errMessage)}
              {err('sensitive', fb.errSensitive)}
            </div>
            <div>
              <label htmlFor="fb-contact" className="label">{fb.contact}</label>
              <input id="fb-contact" type="email" inputMode="email" autoComplete="email" value={contact} onChange={(e) => setContact(e.target.value.slice(0, 200))} placeholder={fb.contactPlaceholder} className="field" aria-invalid={!!errors.contact} />
              {err('contact', fb.errContact)}
            </div>
            {sendError && (
              <p className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {sendError}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{' '}
              {sending ? fb.sending : storage ? fb.submitStored : fb.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
