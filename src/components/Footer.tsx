import { useI18n } from '../i18n';
import type { Route } from '../lib/router';
import { Logo } from './Logo';
import { RESOURCES } from '../data/resources';

export function Footer({ navigate }: { navigate: (r: Route, s?: string) => void }) {
  const { t, lang } = useI18n();
  const links: [Route, string?][] = [['home'], ['assistant'], ['complaint'], ['quiz']];
  const help: [Route, string | undefined, string][] = [
    ['resources', undefined, t.nav.resources],
    ['feedback', undefined, t.nav.feedback],
    ['home', 'privacy', t.footer.privacy],
  ];
  return (
    <footer className="mt-24 bg-navy-950 text-navy-300">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <Logo inverted />
          <p className="font-serif text-lg text-white">{t.brand.tagline}</p>
          <p className="text-sm leading-relaxed">{t.footer.about}</p>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-[0.1em] text-white uppercase">{t.footer.sections}</h3>
          <ul className="space-y-2 text-sm">
            {links.map(([r]) => (
              <li key={r}>
                <button type="button" onClick={() => navigate(r)} className="hover:text-white">{t.nav[r]}</button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-[0.1em] text-white uppercase">{t.footer.help}</h3>
          <ul className="space-y-2 text-sm">
            {help.map(([r, s, label]) => (
              <li key={label}>
                <button type="button" onClick={() => navigate(r, s)} className="hover:text-white">{label}</button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-[0.1em] text-white uppercase">{t.resources.external}</h3>
          <ul className="space-y-2 text-sm">
            {RESOURCES.map((r) => (
              <li key={r.id}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-white">{r.domain}</a>
                <span className="sr-only"> — {r.name[lang]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} ADAL AI · {t.footer.rights} · «3-бағыт. IT-шешім»</span>
          <span>{t.brand.prototype}</span>
        </div>
      </div>
    </footer>
  );
}
