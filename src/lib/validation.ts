export interface FeedbackInput {
  category: string;
  message: string;
  contact: string;
}

export type FeedbackErrors = Partial<Record<'category' | 'message' | 'contact' | 'sensitive', true>>;

const CATEGORIES = ['idea', 'ux', 'content', 'bug', 'other'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// 12-digit IIN-like numbers or 16-digit card-like numbers (with optional spaces/dashes).
const SENSITIVE = /(\b\d{12}\b)|(\b(?:\d[ -]?){15}\d\b)/;

export function validateFeedback(v: FeedbackInput): FeedbackErrors {
  const e: FeedbackErrors = {};
  if (!CATEGORIES.includes(v.category)) e.category = true;
  const m = v.message.trim();
  if (m.length < 10 || m.length > 1000) e.message = true;
  if (v.contact.trim() && !EMAIL.test(v.contact.trim())) e.contact = true;
  if (SENSITIVE.test(v.message)) e.sensitive = true;
  return e;
}
