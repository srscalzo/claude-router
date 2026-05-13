#!/usr/bin/env node
import { Command } from 'commander';
import { runStats } from './stats';

const program = new Command();

program
  .name('claude-router')
  .description('Automatic cost optimization and routing layer for the Anthropic Claude API')
  .version('0.1.0');

program
  .command('stats')
  .description('Show cost analytics from logged requests')
  .option('--log-path <path>', 'Path to the JSONL log file')
  .action(async (options: { logPath?: string }) => {
    await runStats(options.logPath);
  });

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
