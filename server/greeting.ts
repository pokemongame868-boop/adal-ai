import { GREETINGS, type Lang } from './lang.ts';

const ALL = [GREETINGS.kk, GREETINGS.ru];
const norm = (s: string) => s.replace(/[*_#>\s]+/g, ' ').trim().toLowerCase();

/** Guarantees the greeting rule regardless of model compliance. */
export function enforceGreeting(reply: string, isFirstTurn: boolean, lang: Lang): string {
  let text = reply.trim();
  // Strip any greeting line the model emitted at the start.
  const lines = text.split('\n');
  const first = norm(lines[0] || '');
  const startsWithGreeting = ALL.some((g) => first.startsWith(norm(g).replace(/ 👋$/, '')));
  if (startsWithGreeting) text = lines.slice(1).join('\n').trim();

  if (isFirstTurn && (lang === 'kk' || lang === 'ru')) {
    return `${GREETINGS[lang]}\n\n${text}`;
  }
  return text;
}
