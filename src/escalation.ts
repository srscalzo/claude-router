import type Anthropic from '@anthropic-ai/sdk';
import type { PromptTier } from './types';

const UNCERTAINTY_PHRASES = [
  "i'm not sure",
  "i am not sure",
  "i cannot",
  "i can't",
  "i don't have enough",
  "i do not have enough",
  "i don't know",
  "i do not know",
  "i'm unable",
  "i am unable",
];

function getFirstTextContent(response: Anthropic.Message): string {
  for (const block of response.content) {
    if (block.type === 'text') return block.text.toLowerCase();
  }
  return '';
}

export function shouldEscalate(response: Anthropic.Message, tier: PromptTier): boolean {
  if (response.model === 'claude-opus-4-7') return false;

  const outputTokens = response.usage.output_tokens;
  if (outputTokens < 50 && tier >= 2) return true;

  const text = getFirstTextContent(response);
  if (UNCERTAINTY_PHRASES.some(phrase => text.includes(phrase))) return true;

  return false;
}
