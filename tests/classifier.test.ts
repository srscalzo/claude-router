import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/classifier';

test('short greeting → tier 1', () => {
  const result = classify({
    messages: [{ role: 'user', content: 'Hello, how are you?' }],
    max_tokens: 100,
  });
  assert.equal(result.tier, 1);
  assert.equal(result.hasCode, false);
  assert.equal(result.hasComplexKeywords, false);
});

test('code block in message → at least tier 2', () => {
  const result = classify({
    messages: [{ role: 'user', content: 'Fix this:\n```ts\nconst x = 1;\n```' }],
    max_tokens: 1024,
  });
  assert.ok(result.tier >= 2);
  assert.equal(result.hasCode, true);
});

test('"architect" keyword → at least tier 2', () => {
  const result = classify({
    messages: [{ role: 'user', content: 'architect a scalable microservices system for our startup' }],
    max_tokens: 4096,
  });
  assert.ok(result.tier >= 2);
  assert.equal(result.hasComplexKeywords, true);
});

test('"refactor" keyword → at least tier 2', () => {
  const result = classify({
    messages: [{ role: 'user', content: 'refactor this function' }],
    max_tokens: 512,
  });
  assert.ok(result.tier >= 2);
});

test('large conversation history → higher tier', () => {
  const messages = Array.from({ length: 12 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: 'short message',
  }));
  const result = classify({ messages, max_tokens: 1024 });
  assert.ok(result.tier >= 2);
  assert.equal(result.messageCount, 12);
});

test('long system prompt bumps score', () => {
  const result = classify({
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 100,
    system: 'x'.repeat(600),
  });
  assert.ok(result.tier >= 1);
});

test('code + architect keyword → tier 3', () => {
  const result = classify({
    messages: [{
      role: 'user',
      content: 'architect this:\n```python\ndef foo(): pass\n```',
    }],
    max_tokens: 2048,
  });
  assert.equal(result.tier, 3);
});

test('estimated tokens calculated from text length', () => {
  const content = 'a'.repeat(4000);
  const result = classify({
    messages: [{ role: 'user', content }],
    max_tokens: 1024,
  });
  assert.ok(result.estimatedTokens >= 1000);
});

test('text block params are extracted correctly', () => {
  const result = classify({
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: 'architect a solution' }],
    }],
    max_tokens: 1024,
  });
  assert.equal(result.hasComplexKeywords, true);
});
