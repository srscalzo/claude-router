import { ClaudeRouter } from '../router';
import { classify } from '../classifier';
import type { RouterRunParams } from '../types';

const TIER_LABEL: Record<number, string> = {
  1: 'Tier 1 — Haiku  (simple)',
  2: 'Tier 2 — Sonnet (moderate)',
  3: 'Tier 3 — Opus   (complex)',
};

export async function runAsk(prompt: string, options: { logPath?: string; model?: string }): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('Set it with: $env:ANTHROPIC_API_KEY = "sk-ant-..."');
    process.exit(1);
  }

  const params: RouterRunParams = {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1024,
  };

  if (options.model) {
    params.model = options.model as RouterRunParams['model'];
  }

  const classification = classify(params);

  if (!options.model) {
    console.error(`\nClassified as ${TIER_LABEL[classification.tier]}`);
  }
  console.error('Sending request...\n');

  const router = new ClaudeRouter({ apiKey, logPath: options.logPath });
  const start = Date.now();
  const response = await router.run(params);
  const latencyMs = Date.now() - start;

  for (const block of response.content) {
    if (block.type === 'text') process.stdout.write(block.text);
  }
  process.stdout.write('\n');

  const escalated = options.model ? false : response.model !== {
    1: 'claude-haiku-4-5-20251001',
    2: 'claude-sonnet-4-6',
    3: 'claude-opus-4-7',
  }[classification.tier];

  console.error('\n───────────────────────────────────────────────');
  console.error(`  Model:    ${response.model}${escalated ? '  ↑ escalated' : ''}`);
  console.error(`  Tokens:   ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);
  console.error(`  Latency:  ${latencyMs} ms`);
  console.error('───────────────────────────────────────────────\n');
}
