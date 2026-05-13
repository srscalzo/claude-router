import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldEscalate } from '../src/escalation';
import type Anthropic from '@anthropic-ai/sdk';

function makeResponse(overrides: Partial<{
  model: string;
  outputTokens: number;
  text: string;
}>): Anthropic.Message {
  const { model = 'claude-haiku-4-5-20251001', outputTokens = 100, text = 'Here is the answer.' } = overrides;
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: outputTokens },
  } as Anthropic.Message;
}

test('short output on tier 2 task → escalate', () => {
  const response = makeResponse({ outputTokens: 20 });
  assert.equal(shouldEscalate(response, 2), true);
});

test('short output on tier 1 task → do not escalate', () => {
  const response = makeResponse({ outputTokens: 20 });
  assert.equal(shouldEscalate(response, 1), false);
});

test('uncertainty phrase → escalate', () => {
  const response = makeResponse({ text: "I'm not sure how to answer that." });
  assert.equal(shouldEscalate(response, 1), true);
});

test('"I cannot" phrase → escalate', () => {
  const response = makeResponse({ text: 'I cannot provide that information.' });
  assert.equal(shouldEscalate(response, 2), true);
});

test('already at opus → never escalate', () => {
  const response = makeResponse({ model: 'claude-opus-4-7', outputTokens: 5, text: "I'm not sure" });
  assert.equal(shouldEscalate(response, 3), false);
});

test('good long response → do not escalate', () => {
  const response = makeResponse({ outputTokens: 200, text: 'Here is a detailed explanation of the solution...' });
  assert.equal(shouldEscalate(response, 3), false);
});

test('no text content → do not escalate based on phrases', () => {
  const response = {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content: [{ type: 'tool_use', id: 'tool_1', name: 'calculator', input: {} }],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 50, output_tokens: 100 },
  } as unknown as Anthropic.Message;
  assert.equal(shouldEscalate(response, 2), false);
});
