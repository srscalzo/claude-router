import type { ModelId, PromptTier } from './types';

export const TIER_TO_MODEL: Record<PromptTier, ModelId> = {
  1: 'claude-haiku-4-5-20251001',
  2: 'claude-sonnet-4-6',
  3: 'claude-opus-4-7',
};

const ESCALATION_CHAIN: Partial<Record<ModelId, ModelId>> = {
  'claude-haiku-4-5-20251001': 'claude-sonnet-4-6',
  'claude-sonnet-4-6': 'claude-opus-4-7',
};

export function getNextModel(model: ModelId): ModelId | null {
  return ESCALATION_CHAIN[model] ?? null;
}
