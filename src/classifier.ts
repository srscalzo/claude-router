import type Anthropic from '@anthropic-ai/sdk';
import type { ClassificationResult, RouterRunParams } from './types';

const COMPLEX_KEYWORDS = [
  'refactor', 'design', 'architect', 'optimize', 'analyze',
  'compare', 'explain in depth', 'trade-off', 'tradeoff',
  'scalab', 'performance', 'security audit',
];

function extractText(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
    .map(b => b.text)
    .join(' ');
}

export function classify(params: RouterRunParams): ClassificationResult {
  // Score code/keywords from user messages only — system prompt is infrastructure context,
  // not a signal of what the user is actually asking.
  const messageText = params.messages.map(m => extractText(m.content)).join('\n');
  const systemText = typeof params.system === 'string'
    ? params.system
    : (params.system ?? [])
        .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
        .map(b => b.text)
        .join(' ');

  const estimatedTokens = Math.ceil(messageText.length / 4);
  const hasCode = messageText.includes('```');
  const lowerMessageText = messageText.toLowerCase();
  const hasComplexKeywords = COMPLEX_KEYWORDS.some(kw => lowerMessageText.includes(kw));
  const messageCount = params.messages.length;

  let score = 0;

  if (estimatedTokens > 2000) score += 2;
  else if (estimatedTokens > 500) score += 1;

  if (hasCode) score += 2;
  if (hasComplexKeywords) score += 2;

  if (messageCount > 10) score += 2;
  else if (messageCount > 4) score += 1;

  if (systemText.length > 500) score += 1;

  const tier = score >= 4 ? 3 : score >= 2 ? 2 : 1;

  return { tier, estimatedTokens, hasCode, hasComplexKeywords, messageCount };
}
