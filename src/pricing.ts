import type { ModelId, ModelPricing, PromptTier } from './types';

export const PRICING: Record<ModelId, ModelPricing> = {
  'claude-haiku-4-5-20251001': { inputPerMillion: 0.80, outputPerMillion: 4.00 },
  'claude-sonnet-4-6':         { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-opus-4-7':           { inputPerMillion: 15.00, outputPerMillion: 75.00 },
};

export const TIER_TO_MODEL: Record<PromptTier, ModelId> = {
  1: 'claude-haiku-4-5-20251001',
  2: 'claude-sonnet-4-6',
  3: 'claude-opus-4-7',
};

export const ESCALATION_CHAIN: Partial<Record<ModelId, ModelId>> = {
  'claude-haiku-4-5-20251001': 'claude-sonnet-4-6',
  'claude-sonnet-4-6': 'claude-opus-4-7',
};

export function calculateCost(model: ModelId, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model];
  return (inputTokens / 1_000_000) * pricing.inputPerMillion
       + (outputTokens / 1_000_000) * pricing.outputPerMillion;
}

export function getNextModel(model: ModelId): ModelId | null {
  return ESCALATION_CHAIN[model] ?? null;
}
