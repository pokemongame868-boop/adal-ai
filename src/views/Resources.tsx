import { ArrowUpRight, Globe2, Phone } from 'lucide-react';
import { useI18n } from '../i18n';
import { RESOURCES } from '../data/resources';
import { SectionHeader } from '../components/SectionHeader';

export function Resources() {
  const { t, lang } = useI18n();
  const r = t.resources;
  return (
    <div className="container-x py-12 sm:py-16">
      <SectionHeader as="h1" eyebrow={r.eyebrow} title={r.title} lead={r.lead} />
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {RESOURCES.map((res) => (
          <article key={res.id} className="card flex flex-col p-6 sm:p-7">
            <div className="mb-4 flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-800"><Globe2 size={21} /></span>
              <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium text-navy-600">{r.external}</span>
            </div>
            <h2 className="font-serif text-xl font-semibold">{res.name[lang]}</h2>
            <p className="mt-1 text-sm text-navy-500">{res.domain}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-navy-700">{res.purpose[lang]}</p>
            <div className="mt-4 flex-1 rounded-xl bg-paper-2 px-4 py-3">
              <div className="mb-1 text-xs font-semibold tracking-[0.06em] text-navy-500 uppercase">{r.when}</div>
              <p className="text-sm leading-relaxed text-navy-700">{res.when[lang]}</p>
            </div>
            <a href={res.url} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-5 self-start">
              {r.open} <ArrowUpRight size={16} />
            </a>
          </article>
        ))}
      </div>
      <div className="mt-6 flex gap-4 rounded-2xl border border-red-200 bg-red-50/70 p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"><Phone size={18} /></span>
        <div>
          <h2 className="font-semibold text-red-950">{r.emergencyTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-red-900">{r.emergencyText}</p>
        </div>
      </div>
    </div>
  );
}
