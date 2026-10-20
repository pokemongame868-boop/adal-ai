import { useCallback, useEffect, useState } from 'react';

export type Route = 'home' | 'assistant' | 'complaint' | 'quiz' | 'resources' | 'feedback';
const ROUTES: Route[] = ['home', 'assistant', 'complaint', 'quiz', 'resources', 'feedback'];

function parse(): { route: Route; section: string | null } {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, section] = raw.split('/');
  const route = (ROUTES as string[]).includes(path) ? (path as Route) : 'home';
  return { route, section: section || null };
}

/** Tiny hash router: #/assistant, #/home/how. No private data ever goes into the URL. */
export function useRouter() {
  const [state, setState] = useState(parse);

  useEffect(() => {
    const onHash = () => setState(parse());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (state.section) {
      const id = state.section;
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }
    window.scrollTo({ top: 0 });
  }, [state]);

  const navigate = useCallback((route: Route, section?: string) => {
    const hash = `#/${route}${section ? `/${section}` : ''}`;
    if (window.location.hash === hash) {
      if (section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.hash = hash;
    }
  }, []);

  return { ...state, navigate };
}
