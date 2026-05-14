import Anthropic from '@anthropic-ai/sdk';
import { classify } from './classifier';
import { shouldEscalate } from './escalation';
import { Logger } from './logger';
import { getNextModel, TIER_TO_MODEL } from './pricing';
import type { ModelId, RouterOptions, RouterRunParams } from './types';

export class ClaudeRouter {
  private readonly client: Anthropic;
  private readonly logger: Logger;
  private readonly maxRetries: number;
  private readonly disableEscalation: boolean;

  constructor(options: RouterOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.logger = new Logger(options.logPath);
    this.maxRetries = options.maxRetries ?? 2;
    this.disableEscalation = options.disableEscalation ?? false;
  }

  async run(params: RouterRunParams): Promise<Anthropic.Message> {
    const startTime = Date.now();
    const classification = classify(params);

    const intendedModel: ModelId = params.model ?? TIER_TO_MODEL[classification.tier];
    let currentModel: ModelId = intendedModel;

    let attempts = 0;
    let escalations = 0;
    let lastResponse: Anthropic.Message | undefined;

    while (attempts <= this.maxRetries) {
      attempts++;

      const apiParams: Anthropic.Messages.MessageCreateParamsNonStreaming = {
        model: currentModel,
        messages: params.messages,
        max_tokens: params.max_tokens,
      };

      if (params.system !== undefined) {
        apiParams.system = params.system as string;
      }
      if (params.temperature !== undefined) apiParams.temperature = params.temperature;
      if (params.top_p !== undefined) apiParams.top_p = params.top_p;
      if (params.tools !== undefined) apiParams.tools = params.tools;
      if (params.tool_choice !== undefined) apiParams.tool_choice = params.tool_choice;
      if (params.stop_sequences !== undefined) apiParams.stop_sequences = params.stop_sequences;
      if (params.metadata !== undefined) apiParams.metadata = params.metadata;

      const response = await this.client.messages.create(apiParams);
      lastResponse = response;

      if (!this.disableEscalation && shouldEscalate(response, classification.tier)) {
        const nextModel = getNextModel(currentModel);
        if (nextModel) {
          currentModel = nextModel;
          escalations++;
          continue;
        }
      }

      const latencyMs = Date.now() - startTime;

      try {
        await this.logger.write({
          timestamp: new Date().toISOString(),
          model_used: currentModel,
          model_intended: intendedModel,
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          latency_ms: latencyMs,
          retries: attempts - 1 - escalations,
          escalations,
          prompt_tier: classification.tier,
        });
      } catch {
        // log writes are best-effort
      }

      return response;
    }

    return lastResponse!;
  }
}
