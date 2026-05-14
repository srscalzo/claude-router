import { Logger } from '../logger';
import type { LogEntry, ModelId, StatsReport } from '../types';

function pad(s: string, width: number): string {
  return s.padEnd(width);
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export function computeStats(entries: LogEntry[]): StatsReport {
  const modelDistribution: Record<ModelId, number> = {
    'claude-haiku-4-5-20251001': 0,
    'claude-sonnet-4-6': 0,
    'claude-opus-4-7': 0,
  };

  if (entries.length === 0) {
    return {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      modelDistribution,
      averageLatencyMs: 0,
      totalEscalations: 0,
    };
  }

  for (const e of entries) {
    modelDistribution[e.model_used] = (modelDistribution[e.model_used] ?? 0) + 1;
  }

  return {
    totalRequests: entries.length,
    totalInputTokens: entries.reduce((sum, e) => sum + e.input_tokens, 0),
    totalOutputTokens: entries.reduce((sum, e) => sum + e.output_tokens, 0),
    modelDistribution,
    averageLatencyMs: entries.reduce((sum, e) => sum + e.latency_ms, 0) / entries.length,
    totalEscalations: entries.reduce((sum, e) => sum + e.escalations, 0),
  };
}

function printReport(report: StatsReport): void {
  const line = '─'.repeat(52);
  console.log('\n Claude Router — Usage Analytics');
  console.log(line);

  if (report.totalRequests === 0) {
    console.log('  No requests logged yet.');
    console.log(line + '\n');
    return;
  }

  console.log(`  ${pad('Total requests:', 28)} ${report.totalRequests}`);
  console.log(`  ${pad('Total input tokens:', 28)} ${report.totalInputTokens.toLocaleString()}`);
  console.log(`  ${pad('Total output tokens:', 28)} ${report.totalOutputTokens.toLocaleString()}`);
  console.log(`  ${pad('Total escalations:', 28)} ${report.totalEscalations}`);
  console.log(line);
  console.log('  Model distribution:');
  for (const [model, count] of Object.entries(report.modelDistribution)) {
    const share = pct(count / report.totalRequests);
    console.log(`    ${pad(model + ':', 36)} ${count} (${share})`);
  }
  console.log(line);
  console.log(`  ${pad('Avg latency:', 28)} ${report.averageLatencyMs.toFixed(0)} ms`);
  console.log(line + '\n');
}

export async function runStats(logPath?: string): Promise<void> {
  const logger = new Logger(logPath);
  const entries = await logger.readAll();
  const report = computeStats(entries);
  printReport(report);
}
