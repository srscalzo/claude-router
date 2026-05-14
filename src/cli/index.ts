#!/usr/bin/env node
import { Command } from 'commander';
import { runAsk } from './ask';
import { runChat } from './chat';
import { runStats } from './stats';

const program = new Command();

program
  .name('claude-router')
  .description('Automatic cost optimization and routing layer for the Anthropic Claude API')
  .version('0.1.0');

program
  .command('ask <prompt>')
  .description('Send a one-shot prompt through the router and print the response')
  .option('--model <model>', 'Force a specific model (skips routing)')
  .option('--log-path <path>', 'Path to the JSONL log file')
  .action(async (prompt: string, options: { model?: string; logPath?: string }) => {
    await runAsk(prompt, options);
  });

program
  .command('chat')
  .description('Start an interactive chat session with project context')
  .option('--model <model>', 'Force a specific model for all turns')
  .option('--no-context', 'Skip injecting local file structure into the session')
  .option('--log-path <path>', 'Path to the JSONL log file')
  .action(async (options: { model?: string; context?: boolean; logPath?: string }) => {
    await runChat(options);
  });

program
  .command('stats')
  .description('Show usage analytics from logged requests')
  .option('--log-path <path>', 'Path to the JSONL log file')
  .action(async (options: { logPath?: string }) => {
    await runStats(options.logPath);
  });

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
