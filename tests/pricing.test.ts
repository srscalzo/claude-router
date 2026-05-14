import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNextModel, TIER_TO_MODEL } from '../src/pricing';

test('escalation chain: haiku -> sonnet', () => {
  assert.equal(getNextModel('claude-haiku-4-5-20251001'), 'claude-sonnet-4-6');
});

test('escalation chain: sonnet -> opus', () => {
  assert.equal(getNextModel('claude-sonnet-4-6'), 'claude-opus-4-7');
});

test('escalation chain: opus -> null (ceiling)', () => {
  assert.equal(getNextModel('claude-opus-4-7'), null);
});

test('tier 1 maps to haiku', () => {
  assert.equal(TIER_TO_MODEL[1], 'claude-haiku-4-5-20251001');
});

test('tier 2 maps to sonnet', () => {
  assert.equal(TIER_TO_MODEL[2], 'claude-sonnet-4-6');
});

test('tier 3 maps to opus', () => {
  assert.equal(TIER_TO_MODEL[3], 'claude-opus-4-7');
});
