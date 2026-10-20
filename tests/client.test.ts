import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBadges, pointsFor } from '../src/lib/quizLogic.ts';
import { validateFeedback } from '../src/lib/validation.ts';
import { QUIZ } from '../src/data/quiz.ts';
import { ru } from '../src/i18n/ru.ts';
import { kk } from '../src/i18n/kk.ts';

test('quiz data: >= 8 bilingual questions with valid answers', () => {
  assert.ok(QUIZ.length >= 8);
  for (const q of QUIZ) {
    assert.ok(q.options.length >= 3 && q.options.length <= 4);
    assert.ok(q.correct >= 0 && q.correct < q.options.length);
    for (const s of [q.topic, q.situation, q.explanation, ...q.options]) assert.ok(s.ru && s.kk);
  }
});

test('quiz scoring and badges', () => {
  assert.equal(pointsFor(false, 0), 0);
  assert.equal(pointsFor(true, 1), 10);
  assert.equal(pointsFor(true, 3), 15);
  const all = computeBadges(Array(8).fill(true), 8);
  assert.deepEqual(all, { first: true, streak: true, expert: true, perfect: true });
  const some = computeBadges([true, false, true, true, false, true, false, false], 8);
  assert.deepEqual(some, { first: true, streak: false, expert: false, perfect: false });
});

test('feedback validation', () => {
  assert.ok(validateFeedback({ category: '', message: 'short', contact: 'bad' }).category);
  assert.ok(validateFeedback({ category: 'idea', message: 'short', contact: '' }).message);
  assert.ok(validateFeedback({ category: 'idea', message: 'Добавьте тёмную тему, пожалуйста', contact: 'bad@' }).contact);
  assert.ok(validateFeedback({ category: 'idea', message: 'Мой ИИН 990101300123 для связи', contact: '' }).sensitive);
  assert.deepEqual(validateFeedback({ category: 'ux', message: 'Добавьте тёмную тему, пожалуйста', contact: 'a@b.kz' }), {});
});

test('dictionaries have identical key structure and no empty strings', () => {
  const walk = (a: unknown, b: unknown, path: string) => {
    if (typeof a === 'string') {
      assert.equal(typeof b, 'string', path);
      assert.ok((b as string).trim(), `empty kk: ${path}`);
      return;
    }
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    assert.deepEqual(ka, kb, path);
    for (const k of ka) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
  };
  walk(ru, kk, 'root');
});
