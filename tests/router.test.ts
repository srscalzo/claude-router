import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { ClaudeRouter } from '../src/router';
import type Anthropic from '@anthropic-ai/sdk';

function makeResponse(overrides: Partial<{
  model: string;
  outputTokens: number;
  text: string;
}>): Anthropic.Message {
  const { model = 'claude-haiku-4-5-20251001', outputTokens = 100, text = 'The answer is 4.' } = overrides;
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 50, output_tokens: outputTokens },
  } as Anthropic.Message;
}

function makeMockRouter(responses: Anthropic.Message[], logPath: string): ClaudeRouter {
  const router = new ClaudeRouter({ apiKey: 'test-key', logPath });
  let callIndex = 0;
  // Override the internal client with a mock
  (router as unknown as Record<string, unknown>)['client'] = {
    messages: {
      create: async (_params: unknown) => {
        const response = responses[callIndex] ?? responses[responses.length - 1];
        callIndex++;
        return response;
      },
    },
  };
  return router;
}

function tmpLogPath(): string {
  return path.join(os.tmpdir(), `cr-router-test-${Date.now()}.jsonl`);
}

test('simple prompt routes to haiku and returns response', async () => {
  const logPath = tmpLogPath();
  const mockResponse = makeResponse({});
  const router = makeMockRouter([mockResponse], logPath);

  const result = await router.run({
    messages: [{ role: 'user', content: 'What is 2+2?' }],
    max_tokens: 100,
  });

  assert.equal(result.content[0].type, 'text');
  assert.equal((result.content[0] as { type: 'text'; text: string }).text, 'The answer is 4.');

  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
});

test('log entry is written after successful run', async () => {
  const logPath = tmpLogPath();
  const router = makeMockRouter([makeResponse({})], logPath);

  await router.run({
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 100,
  });

  // Allow async log write
  await new Promise(r => setTimeout(r, 50));

  const raw = fs.readFileSync(logPath, 'utf8');
  const entry = JSON.parse(raw.trim());
  assert.equal(entry.model_used, 'claude-haiku-4-5-20251001');
  assert.ok(entry.input_tokens > 0);
  assert.ok(entry.latency_ms >= 0);

  fs.unlinkSync(logPath);
});

test('escalation: short output on tier-2 task upgrades to sonnet', async () => {
  const logPath = tmpLogPath();
  const haikuResponse = makeResponse({ outputTokens: 5, text: 'short' });
  const sonnetResponse = makeResponse({ model: 'claude-sonnet-4-6', outputTokens: 200, text: 'Full answer here.' });
  const router = makeMockRouter([haikuResponse, sonnetResponse], logPath);

  const result = await router.run({
    messages: [{ role: 'user', content: 'analyze this architecture' }],
    max_tokens: 1024,
  });

  assert.equal((result.content[0] as { type: 'text'; text: string }).text, 'Full answer here.');

  await new Promise(r => setTimeout(r, 50));
  if (fs.existsSync(logPath)) {
    const raw = fs.readFileSync(logPath, 'utf8');
    const entry = JSON.parse(raw.trim().split('\n').pop()!);
    assert.equal(entry.escalations, 1);
    fs.unlinkSync(logPath);
  }
});

test('caller-specified model bypasses classifier', async () => {
  const logPath = tmpLogPath();
  const opusResponse = makeResponse({ model: 'claude-opus-4-7', outputTokens: 100, text: 'Opus answer.' });
  const router = makeMockRouter([opusResponse], logPath);

  const usedModels: string[] = [];
  const origCreate = (router as unknown as Record<string, { messages: { create: (p: unknown) => Promise<Anthropic.Message> } }>)['client'].messages.create;
  (router as unknown as Record<string, { messages: { create: (p: unknown) => Promise<Anthropic.Message> } }>)['client'].messages.create = async (params: unknown) => {
    usedModels.push((params as { model: string }).model);
    return origCreate(params);
  };

  await router.run({
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 100,
    model: 'claude-opus-4-7',
  });

  assert.equal(usedModels[0], 'claude-opus-4-7');

  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
});

test('disableEscalation prevents upgrading models', async () => {
  const logPath = tmpLogPath();
  const shortResponse = makeResponse({ outputTokens: 5, text: 'short' });
  const router = new ClaudeRouter({ apiKey: 'test-key', logPath, disableEscalation: true });
  (router as unknown as Record<string, unknown>)['client'] = {
    messages: { create: async () => shortResponse },
  };

  const result = await router.run({
    messages: [{ role: 'user', content: 'analyze this complex architecture design' }],
    max_tokens: 1024,
  });

  assert.equal((result.content[0] as { type: 'text'; text: string }).text, 'short');

  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
});
