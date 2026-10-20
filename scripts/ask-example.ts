/**
 * Example: npm run ask -- "Что такое eOtinish?"
 * Requires OPENROUTER_API_KEY in .env or the environment.
 */
import { loadEnv } from './env.ts';

loadEnv();
const { ask, describeError } = await import('../server/openrouter.ts');

const prompt: string = process.argv.slice(2).join(' ').trim() || 'Кратко, в 2 предложениях: что такое портал eOtinish в Казахстане?';

try {
  const answer: string = await ask(prompt);
  console.log(answer);
} catch (e: unknown) {
  console.error(describeError(e, 'ru'));
  process.exitCode = 1;
}
