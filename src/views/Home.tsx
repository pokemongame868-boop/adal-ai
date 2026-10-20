import { ArrowRight, ClipboardList, FileText, GraduationCap, KeyRound, Landmark, MessageSquareText, ScanSearch, ShieldCheck, Signpost, Sparkles, UserX, Scale, Lock } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Route } from '../lib/router';
import { SectionHeader } from '../components/SectionHeader';
import { ShieldMark } from '../components/Logo';

interface Props {
  navigate: (r: Route, s?: string) => void;
  ask: (prompt?: string) => void;
}

function Preview() {
  const { t } = useI18n();
  const p = t.preview;
  return (
    <figure className="relative">
      <div className="card overflow-hidden shadow-[0_30px_60px_-30px_rgba(15,29,54,.35)]">
        <div className="flex items-center gap-3 border-b border-line bg-paper/60 px-5 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-white">
            <ShieldMark className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{p.title}</div>
            <div className="flex items-center gap-1.5 text-xs text-navy-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {p.status}
            </div>
          </div>
        </div>
        <div className="space-y-4 p-5" aria-hidden="true">
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-navy-900 px-4 py-3 text-[14px] text-white">{p.user}</div>
          <div className="max-w-[92%] space-y-3 rounded-2xl rounded-bl-md border border-line bg-paper/50 px-4 py-3.5 text-[14px]">
            <div className="font-serif font-semibold">{p.h1}</div>
            <p className="text-navy-700">{p.p1}</p>
            <div className="font-serif font-semibold">{p.h2}</div>
            <ol className="space-y-1.5">
              {[p.s1, p.s2, p.s3].map((s, i) => (
                <li key={s} className="flex gap-2.5 text-navy-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-navy-500">{p.caption}</figcaption>
    </figure>
  );
}

export function Home({ navigate, ask }: Props) {
  const { t } = useI18n();
  const featureIcons = [ScanSearch, ClipboardList, Signpost];
  const privacyIcons = [UserX, KeyRound, Lock, Landmark];
  const scenarioIcons = [GraduationCap, Landmark, Scale, FileText];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(23,150,111,.10),transparent_55%)]" aria-hidden="true" />
        <div className="container-x relative grid items-center gap-14 pt-12 pb-20 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="animate-fade-up space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[13px] font-medium text-emerald-800">
              <Sparkles size={14} /> {t.hero.eyebrow}
            </span>
            <h1 className="font-serif text-[40px] leading-[1.08] font-semibold tracking-[-0.02em] text-navy-900 sm:text-[54px]">
              {t.hero.title} <span className="text-emerald-700 italic">{t.hero.titleAccent}</span>
            </h1>
            <p className="lead max-w-xl">{t.hero.lead}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn-primary px-6 py-3" onClick={() => ask()}>
                <MessageSquareText size={18} /> {t.hero.primary}
              </button>
              <button type="button" className="btn-ghost px-6 py-3" onClick={() => navigate('quiz')}>
                <GraduationCap size={18} /> {t.hero.secondary}
              </button>
            </div>
            <p className="flex items-center gap-2 text-sm text-navy-500">
              <ShieldCheck size={16} className="text-emerald-600" /> {t.hero.note}
            </p>
          </div>
          <div className="animate-fade-up [animation-delay:120ms]">
            <Preview />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container-x py-16">
        <SectionHeader eyebrow={t.features.eyebrow} title={t.features.title} />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {t.features.items.map((f, i) => {
            const Icon = featureIcons[i];
            return (
              <article key={f.title} className="card group p-7 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(15,29,54,.4)]">
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon size={22} />
                  </span>
                  <span className="font-serif text-sm text-navy-300">0{i + 1}</span>
                </div>
                <h3 className="mb-2 font-serif text-xl font-semibold">{f.title}</h3>
                <p className="text-[15px] leading-relaxed text-navy-600">{f.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="border-y border-line bg-white/60 py-20">
        <div className="container-x">
          <SectionHeader eyebrow={t.how.eyebrow} title={t.how.title} />
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {t.how.steps.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 font-serif text-[15px] font-semibold text-white">{i + 1}</span>
                  {i < 3 && <span className="hidden h-px flex-1 bg-line lg:block" aria-hidden="true" />}
                </div>
                <h3 className="mb-1.5 text-[17px] font-semibold">{s.title}</h3>
                <p className="text-[15px] leading-relaxed text-navy-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* SCENARIOS */}
      <section id="scenarios" className="container-x py-20">
        <SectionHeader eyebrow={t.scenarios.eyebrow} title={t.scenarios.title} lead={t.scenarios.lead} />
        <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1fr_0.95fr]">
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            {t.scenarios.items.map((s, i) => {
              const Icon = scenarioIcons[i];
              return (
                <button key={s.prompt} type="button" onClick={() => ask(s.prompt)} className="card group flex flex-col items-start gap-4 p-6 text-left transition hover:border-emerald-300 hover:bg-emerald-50/30">
                  <span className="inline-flex items-center gap-2 rounded-full bg-paper-2 px-3 py-1 text-xs font-semibold text-navy-700">
                    <Icon size={14} /> {s.tag}
                  </span>
                  <span className="flex-1 font-serif text-[17px] leading-snug text-navy-900">«{s.prompt}»</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    {t.scenarios.ask} <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col justify-between gap-6 rounded-2xl bg-navy-900 p-7 text-white">
            <div className="space-y-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-emerald-300">
                <GraduationCap size={22} />
              </span>
              <h3 className="font-serif text-2xl font-semibold">{t.scenarios.quizTitle}</h3>
              <p className="text-[15px] leading-relaxed text-navy-200">{t.scenarios.quizText}</p>
            </div>
            <button type="button" className="btn bg-white text-navy-900 hover:bg-emerald-50" onClick={() => navigate('quiz')}>
              {t.scenarios.quizCta} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* PRIVACY */}
      <section id="privacy" className="container-x py-12">
        <div className="card p-7 sm:p-10">
          <SectionHeader eyebrow={t.privacy.eyebrow} title={t.privacy.title} />
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {t.privacy.items.map((p, i) => {
              const Icon = privacyIcons[i];
              return (
                <div key={p.title} className="space-y-2.5">
                  <Icon size={22} className="text-emerald-700" />
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="text-[14.5px] leading-relaxed text-navy-600">{p.text}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-10 rounded-xl bg-paper-2 px-5 py-4 text-sm leading-relaxed text-navy-700">{t.privacy.note}</p>
        </div>
      </section>

      {/* CTA */}
      <section className="container-x pt-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-7 py-9 sm:flex-row sm:items-center sm:px-10">
          <div>
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">{t.cta.title}</h2>
            <p className="mt-1.5 text-navy-600">{t.cta.text}</p>
          </div>
          <button type="button" className="btn-accent px-6 py-3" onClick={() => ask()}>
            {t.cta.button} <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </>
  );
}
