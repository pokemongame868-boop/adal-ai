export type Lang = 'kk' | 'ru' | 'other';

const KAZAKH_LETTERS = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/g;
const CYRILLIC = /[а-яёА-ЯЁ]/g;
const LATIN = /[a-zA-Z]/g;
// Frequent Kazakh words that may be typed without special letters (e.g. on a Russian keyboard).
const KAZAKH_WORDS = /(^|[\s,.!?])(мен|сен|біз|не|неге|қалай|калай|кайда|қайда|жок|жоқ|иа|ия|рахмет|салем|сәлем|керек|болады|ма|ме|ба|бе|па|пе|жане|және|деп|бар|емес|туралы|үшін|ушин|маган|маған)(?=$|[\s,.!?])/gi;
const RUSSIAN_WORDS = /(^|[\s,.!?])(что|как|мне|меня|это|не|и|в|на|у|я|ты|вы|почему|где|делать|можно|нужно|если|или|но|за|по|для|когда|привет|спасибо)(?=$|[\s,.!?])/gi;

export const GREETINGS = {
  kk: 'Сәлем! Мен — ADAL AI көмекшісімін. 👋',
  ru: 'Привет! Я — ADAL, твой цифровой помощник. 👋',
} as const;

/** Heuristic language detection for Kazakh vs Russian vs other. */
export function detectLanguage(text: string): Lang {
  const t = text.trim();
  if (!t) return 'other';
  const kz = (t.match(KAZAKH_LETTERS) || []).length;
  const cyr = (t.match(CYRILLIC) || []).length + kz;
  const lat = (t.match(LATIN) || []).length;
  if (cyr === 0) return lat > 0 ? 'other' : 'other';
  if (lat > cyr * 2) return 'other';
  if (kz >= 1 && kz / cyr >= 0.015) return 'kk';
  const kzWords = (t.match(KAZAKH_WORDS) || []).length;
  const ruWords = (t.match(RUSSIAN_WORDS) || []).length;
  if (kzWords > ruWords && kzWords >= 2) return 'kk';
  return 'ru';
}

export function languageName(lang: Lang): string {
  return lang === 'kk' ? 'Kazakh' : lang === 'ru' ? 'Russian' : "the same language as the user's latest message";
}
