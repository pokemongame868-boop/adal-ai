import { useState } from 'react';
import { Award, CheckCircle2, Flame, Footprints, Lock, MessageSquareText, RotateCcw, Sparkles, Trophy, XCircle } from 'lucide-react';
import { useI18n } from '../i18n';
import { QUIZ, POINTS_PER_CORRECT } from '../data/quiz';
import { computeBadges, pointsFor } from '../lib/quizLogic';
import { SectionHeader } from '../components/SectionHeader';

type Phase = 'intro' | 'question' | 'result';

export function Quiz({ ask }: { ask: (prompt?: string) => void }) {
  const { t, lang, f } = useI18n();
  const q = t.quiz;
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastGain, setLastGain] = useState(0);

  const total = QUIZ.length;
  const current = QUIZ[index];

  const start = () => {
    setPhase('question');
    setIndex(0);
    setSelected(null);
    setAnswered(false);
    setResults([]);
    setPoints(0);
    setStreak(0);
  };

  const check = () => {
    if (selected === null || answered) return;
    const ok = selected === current.correct;
    const nextStreak = ok ? streak + 1 : 0;
    const gain = pointsFor(ok, nextStreak);
    setAnswered(true);
    setResults((r) => [...r, ok]);
    setStreak(nextStreak);
    setPoints((p) => p + gain);
    setLastGain(gain);
  };

  const next = () => {
    if (index + 1 >= total) {
      setPhase('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setAnswered(false);
  };

  const correctCount = results.filter(Boolean).length;
  const badges = computeBadges(results, total);
  const badgeMeta = [
    { id: 'first' as const, icon: Footprints },
    { id: 'streak' as const, icon: Flame },
    { id: 'expert' as const, icon: Award },
    { id: 'perfect' as const, icon: Trophy },
  ];

  return (
    <div className="container-x py-12 sm:py-16">
      <SectionHeader as="h1" eyebrow={q.eyebrow} title={q.title} lead={q.lead} />

      <div className="mx-auto mt-10 max-w-3xl">
        {phase === 'intro' && (
          <div className="card animate-fade-up flex flex-col items-start gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {badgeMeta.map(({ id, icon: Icon }) => (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1 text-xs font-medium text-navy-700">
                    <Icon size={13} /> {q.badges[id].title}
                  </span>
                ))}
              </div>
              <p className="text-sm text-navy-600">{f(q.question, { n: 1, total })} · {POINTS_PER_CORRECT}+</p>
            </div>
            <button type="button" className="btn-primary px-7 py-3" onClick={start}>
              <Sparkles size={17} /> {q.start}
            </button>
          </div>
        )}

        {phase === 'question' && (
          <div key={current.id} className="card animate-fade-up overflow-hidden">
            <div className="border-b border-line px-6 pt-5 pb-4 sm:px-8">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium text-navy-700">{f(q.question, { n: index + 1, total })}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-0.5 font-semibold text-emerald-800">
                  {streak >= 2 && <Flame size={14} />} {f(q.points, { n: points })}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-navy-100" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + (answered ? 1 : 0)}>
                <div className="h-full rounded-full bg-emerald-600 transition-all duration-500" style={{ width: `${((index + (answered ? 1 : 0)) / total) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-6 px-6 py-7 sm:px-8">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-navy-900 px-2.5 py-0.5 font-medium text-white">{current.topic[lang]}</span>
                  <span className="text-navy-500">{q.fictional}</span>
                </div>
                <h2 className="font-serif text-xl leading-snug font-semibold sm:text-[22px]">{current.situation[lang]}</h2>
              </div>
              <fieldset className="space-y-2.5">
                <legend className="sr-only">{current.situation[lang]}</legend>
                {current.options.map((opt, i) => {
                  const isCorrect = i === current.correct;
                  const isSel = i === selected;
                  let cls = 'border-line bg-white hover:border-navy-300';
                  if (!answered && isSel) cls = 'border-navy-900 bg-navy-50 ring-1 ring-navy-900';
                  if (answered && isCorrect) cls = 'border-emerald-500 bg-emerald-50';
                  if (answered && isSel && !isCorrect) cls = 'border-red-300 bg-red-50';
                  if (answered && !isSel && !isCorrect) cls = 'border-line bg-white opacity-60';
                  return (
                    <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-[15px] leading-snug transition ${cls} ${answered ? 'cursor-default' : ''}`}>
                      <input type="radio" name={`q-${current.id}`} className="sr-only" checked={isSel} disabled={answered} onChange={() => setSelected(i)} />
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${isSel ? 'border-navy-900 bg-navy-900 text-white' : 'border-navy-300 text-navy-600'} ${answered && isCorrect ? '!border-emerald-600 !bg-emerald-600 !text-white' : ''}`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{opt[lang]}</span>
                      {answered && isCorrect && <CheckCircle2 size={20} className="shrink-0 text-emerald-600" aria-label={q.correctAnswer} />}
                      {answered && isSel && !isCorrect && <XCircle size={20} className="shrink-0 text-red-600" />}
                    </label>
                  );
                })}
              </fieldset>

              {answered && (
                <div className={`animate-fade-up rounded-xl px-5 py-4 ${results[results.length - 1] ? 'bg-emerald-50 text-emerald-950' : 'bg-red-50 text-red-950'}`} role="status">
                  <div className="mb-1 flex items-center justify-between gap-2 font-semibold">
                    <span className="flex items-center gap-2">
                      {results[results.length - 1] ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      {results[results.length - 1] ? q.correct : q.incorrect}
                    </span>
                    {lastGain > 0 && <span className="text-sm">+{lastGain}</span>}
                  </div>
                  <p className="text-[14.5px] leading-relaxed">{current.explanation[lang]}</p>
                </div>
              )}

              <div className="flex justify-end">
                {!answered ? (
                  <button type="button" className="btn-primary" onClick={check} disabled={selected === null}>{q.check}</button>
                ) : (
                  <button type="button" className="btn-primary" onClick={next}>{index + 1 >= total ? q.finish : q.next}</button>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div className="card animate-fade-up p-7 text-center sm:p-10">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Trophy size={28} /></span>
            <h2 className="font-serif text-3xl font-semibold">{q.resultTitle}</h2>
            <p className="mt-2 text-lg text-navy-700">{f(q.score, { n: correctCount, total })}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700">{f(q.totalPoints, { n: points })}</p>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-navy-600">
              {correctCount >= 7 ? q.levels.high : correctCount >= 5 ? q.levels.mid : q.levels.low}
            </p>
            <h3 className="mt-9 mb-4 text-xs font-semibold tracking-[0.08em] text-navy-500 uppercase">{q.badgesTitle}</h3>
            <div className="grid gap-3 text-left sm:grid-cols-2">
              {badgeMeta.map(({ id, icon: Icon }) => {
                const got = badges[id];
                return (
                  <div key={id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${got ? 'border-emerald-200 bg-emerald-50' : 'border-line bg-paper/60 opacity-70'}`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${got ? 'bg-emerald-600 text-white' : 'bg-navy-100 text-navy-500'}`}>
                      {got ? <Icon size={18} /> : <Lock size={16} />}
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{q.badges[id].title}</div>
                      <div className="text-xs text-navy-600">{got ? q.badges[id].text : `${q.badgeLocked} · ${q.badges[id].text}`}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" className="btn-primary" onClick={start}><RotateCcw size={16} /> {q.restart}</button>
              <button type="button" className="btn-ghost" onClick={() => ask()}><MessageSquareText size={16} /> {q.toAssistant}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
