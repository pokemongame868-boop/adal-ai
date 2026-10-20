/**
 * Checks tool calling and structured outputs for the configured OpenRouter model with
 * separate test requests (uses 2 requests from the free-model daily quota).
 * Usage: npm run probe:openrouter
 */
import { loadEnv } from './env.ts';

loadEnv();
const { readOpenRouterConfig, getOpenRouterClient, describeError } = await import('../server/openrouter.ts');

const cfg = readOpenRouterConfig();
if (!cfg) {
  console.error('OPENROUTER_API_KEY is not set (add it to .env).');
  process.exit(1);
}

try {
  const report = await getOpenRouterClient(cfg).probeCapabilities();
  console.log(JSON.stringify(report, null, 2));
  console.log(
    `\nTool calling: ${report.toolCalling.status} | Structured outputs: ${report.structuredOutputs.status}` +
      '\nADAL chat uses neither feature; only enable them in new code if the status is "supported".',
  );
} catch (e: unknown) {
  console.error(describeError(e, 'ru'));
  process.exitCode = 1;
}
