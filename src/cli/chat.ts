import readline from 'node:readline';
import type Anthropic from '@anthropic-ai/sdk';
import { ClaudeRouter } from '../router';
import { buildContext } from './context';
import type { RouterRunParams } from '../types';

interface SessionStats {
  turns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  models: Record<string, number>;
}

function printSessionSummary(stats: SessionStats): void {
  const line = '─'.repeat(52);
  console.error(`\n${line}`);
  console.error('  Session summary');
  console.error(line);
  console.error(`  Turns:               ${stats.turns}`);
  console.error(`  Total input tokens:  ${stats.totalInputTokens.toLocaleString()}`);
  console.error(`  Total output tokens: ${stats.totalOutputTokens.toLocaleString()}`);
  console.error('  Models used:');
  for (const [model, count] of Object.entries(stats.models)) {
    console.error(`    ${model}: ${count} turn${count !== 1 ? 's' : ''}`);
  }
  console.error(`${line}\n`);
}

export async function runChat(options: { model?: string; context?: boolean; logPath?: string }): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('Set it with: $env:ANTHROPIC_API_KEY = "sk-ant-..."');
    process.exit(1);
  }

  const noContext = options.context === false;
  let system: Anthropic.TextBlockParam[] | undefined;

  if (!noContext) {
    const context = buildContext(process.cwd());
    system = [{
      type: 'text',
      text: `You are a helpful assistant with access to the user's current project.\n\n${context}`,
      // Cache the context for 5 minutes — subsequent turns pay ~10% of the first turn's cost.
      cache_control: { type: 'ephemeral' },
    }];
    console.error('Project context loaded and cached.');
  }

  console.error('\nClaude Router Chat — type "exit" to quit\n');

  const router = new ClaudeRouter({ apiKey, logPath: options.logPath });
  const messages: Anthropic.MessageParam[] = [];
  const stats: SessionStats = { turns: 0, totalInputTokens: 0, totalOutputTokens: 0, models: {} };

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

  const nextTurn = (): void => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (!trimmed || trimmed === 'exit' || trimmed === 'quit') {
        printSessionSummary(stats);
        rl.close();
        return;
      }

      messages.push({ role: 'user', content: trimmed });

      const params: RouterRunParams = {
        messages,
        max_tokens: 1024,
        ...(system && { system }),
        ...(options.model && { model: options.model as RouterRunParams['model'] }),
      };

      try {
        const response = await router.run(params);

        process.stdout.write('\nAssistant: ');
        for (const block of response.content) {
          if (block.type === 'text') process.stdout.write(block.text);
        }
        process.stdout.write('\n');

        console.error(`\n[${response.model} | ${response.usage.input_tokens} in / ${response.usage.output_tokens} out]\n`);

        messages.push({ role: 'assistant', content: response.content });

        stats.turns++;
        stats.totalInputTokens += response.usage.input_tokens;
        stats.totalOutputTokens += response.usage.output_tokens;
        stats.models[response.model] = (stats.models[response.model] ?? 0) + 1;
      } catch (err) {
        console.error('Error:', (err as Error).message ?? err);
      }

      nextTurn();
    });
  };

  rl.on('close', () => process.exit(0));
  nextTurn();
}
