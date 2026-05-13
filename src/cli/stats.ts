import { Logger } from '../logger';
import { PRICING } from '../pricing';
import type { LogEntry, ModelId, StatsReport } from '../types';

function pad(s: string, width: number): string {
  return s.padEnd(width);
}

function fmt(n: number, decimals = 4): string {
  return n.toFixed(decimals);
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export function computeStats(entries: LogEntry[]): StatsReport {
  if (entries.length === 0) {
    const zero: StatsReport = {
      totalRequests: 0,
      totalCostUsd: 0,
      estimatedCostSonnet: 0,
      estimatedCostOpus: 0,
      savingsVsSonnetUsd: 0,
      savingsVsSonnetPct: 0,
      savingsVsOpusUsd: 0,
      savingsVsOpusPct: 0,
      modelDistribution: {
        'claude-haiku-4-5-20251001': 0,
        'claude-sonnet-4-6': 0,
        'claude-opus-4-7': 0,
      },
      averageLatencyMs: 0,
    };
    return zero;
  }

  const totalCostUsd = entries.reduce((sum, e) => sum + e.cost_usd, 0);
  const sonnetPricing = PRICING['claude-sonnet-4-6'];
  const opusPricing = PRICING['claude-opus-4-7'];

  const estimatedCostSonnet = entries.reduce((sum, e) =>
    sum + (e.input_tokens / 1_000_000) * sonnetPricing.inputPerMillion
        + (e.output_tokens / 1_000_000) * sonnetPricing.outputPerMillion, 0);

  const estimatedCostOpus = entries.reduce((sum, e) =>
    sum + (e.input_tokens / 1_000_000) * opusPricing.inputPerMillion
        + (e.output_tokens / 1_000_000) * opusPricing.outputPerMillion, 0);

  const savingsVsSonnetUsd = estimatedCostSonnet - totalCostUsd;
  const savingsVsOpusUsd = estimatedCostOpus - totalCostUsd;

  const modelDistribution: Record<ModelId, number> = {
    'claude-haiku-4-5-20251001': 0,
    'claude-sonnet-4-6': 0,
    'claude-opus-4-7': 0,
  };
  for (const e of entries) {
    modelDistribution[e.model_used] = (modelDistribution[e.model_used] ?? 0) + 1;
  }

  const averageLatencyMs = entries.reduce((sum, e) => sum + e.latency_ms, 0) / entries.length;

  return {
    totalRequests: entries.length,
    totalCostUsd,
    estimatedCostSonnet,
    estimatedCostOpus,
    savingsVsSonnetUsd,
    savingsVsSonnetPct: estimatedCostSonnet > 0 ? savingsVsSonnetUsd / estimatedCostSonnet : 0,
    savingsVsOpusUsd,
    savingsVsOpusPct: estimatedCostOpus > 0 ? savingsVsOpusUsd / estimatedCostOpus : 0,
    modelDistribution,
    averageLatencyMs,
  };
}

function printReport(report: StatsReport): void {
  const line = '─'.repeat(52);
  console.log('\n Claude Router — Cost Analytics');
  console.log(line);

  if (report.totalRequests === 0) {
    console.log('  No requests logged yet.');
    console.log(line + '\n');
    return;
  }

  console.log(`  ${pad('Total requests:', 28)} ${report.totalRequests}`);
  console.log(`  ${pad('Actual cost:', 28)} $${fmt(report.totalCostUsd)}`);
  console.log(`  ${pad('Est. cost (always Sonnet):', 28)} $${fmt(report.estimatedCostSonnet)}`);
  console.log(`  ${pad('Est. cost (always Opus):', 28)} $${fmt(report.estimatedCostOpus)}`);
  console.log(line);
  console.log(`  ${pad('Savings vs Sonnet:', 28)} $${fmt(report.savingsVsSonnetUsd)} (${pct(report.savingsVsSonnetPct)})`);
  console.log(`  ${pad('Savings vs Opus:', 28)} $${fmt(report.savingsVsOpusUsd)} (${pct(report.savingsVsOpusPct)})`);
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
