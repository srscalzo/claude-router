import type Anthropic from '@anthropic-ai/sdk';

export type PromptTier = 1 | 2 | 3;

export type ModelId =
  | 'claude-haiku-4-5-20251001'
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-7';

export interface RouterRunParams {
  messages: Anthropic.MessageParam[];
  max_tokens: number;
  model?: ModelId;
  system?: string | Anthropic.TextBlockParam[];
  temperature?: number;
  top_p?: number;
  tools?: Anthropic.Tool[];
  tool_choice?: Anthropic.ToolChoiceAuto | Anthropic.ToolChoiceTool | Anthropic.ToolChoiceAny;
  stop_sequences?: string[];
  metadata?: Anthropic.Messages.MessageCreateParamsNonStreaming['metadata'];
}

export interface RouterOptions {
  apiKey: string;
  maxRetries?: number;
  disableEscalation?: boolean;
  logPath?: string;
}

export interface ClassificationResult {
  tier: PromptTier;
  estimatedTokens: number;
  hasCode: boolean;
  hasComplexKeywords: boolean;
  messageCount: number;
}

export interface LogEntry {
  timestamp: string;
  model_used: ModelId;
  model_intended: ModelId;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  retries: number;
  escalations: number;
  prompt_tier: PromptTier;
}

export interface StatsReport {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  modelDistribution: Record<ModelId, number>;
  averageLatencyMs: number;
  totalEscalations: number;
}
