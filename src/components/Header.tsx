import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useI18n, type UILang } from '../i18n';
import type { Route } from '../lib/router';
import { Logo } from './Logo';

const LINKS: Route[] = ['assistant', 'complaint', 'quiz', 'resources', 'feedback'];

export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const opts: { id: UILang; label: string }[] = [
    { id: 'ru', label: 'RU' },
    { id: 'kk', label: 'KZ' },
  ];
  return (
    <div role="group" aria-label={t.nav.language} className={`inline-flex rounded-full border border-line bg-white p-0.5 ${className}`}>
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setLang(o.id)}
          aria-pressed={lang === o.id}
          className={`rounded-full px-3 py-1 text-[13px] font-semibold tracking-wide transition ${
            lang === o.id ? 'bg-navy-900 text-white' : 'text-navy-600 hover:text-navy-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Header({ route, navigate }: { route: Route; navigate: (r: Route, s?: string) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  const go = (r: Route) => {
    setOpen(false);
    navigate(r);
  };

  return (
    <header className={`sticky top-0 z-40 transition-all ${scrolled || open ? 'border-b border-line bg-paper/90 backdrop-blur-md' : 'border-b border-transparent'}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        {t.nav.skip}
      </a>
      <div className="container-x flex h-[68px] items-center justify-between gap-4">
        <Logo onClick={() => go('home')} />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => go(r)}
              aria-current={route === r ? 'page' : undefined}
              className={`rounded-full px-3.5 py-2 text-[14.5px] font-medium transition ${
                route === r ? 'bg-white text-navy-900 shadow-[0_0_0_1px_var(--color-line)]' : 'text-navy-600 hover:text-navy-900'
              }`}
            >
              {t.nav[r]}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LangSwitch />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t.nav.close : t.nav.menu}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="container-x animate-fade-up pb-5 lg:hidden" aria-label="Mobile">
          <ul className="card divide-y divide-line overflow-hidden">
            {(['home', ...LINKS] as Route[]).map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => go(r)}
                  className={`flex w-full items-center justify-between px-5 py-4 text-left text-[16px] font-medium ${route === r ? 'text-emerald-700' : 'text-navy-800'}`}
                >
                  {t.nav[r]}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
