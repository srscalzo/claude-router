import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCost, getNextModel, TIER_TO_MODEL } from '../src/pricing';

test('haiku cost calculation', () => {
  const cost = calculateCost('claude-haiku-4-5-20251001', 1_000_000, 1_000_000);
  assert.equal(cost, 0.80 + 4.00);
});

test('sonnet cost calculation', () => {
  const cost = calculateCost('claude-sonnet-4-6', 1_000_000, 1_000_000);
  assert.equal(cost, 3.00 + 15.00);
});

test('opus cost calculation', () => {
  const cost = calculateCost('claude-opus-4-7', 1_000_000, 1_000_000);
  assert.equal(cost, 15.00 + 75.00);
});

test('zero tokens cost is zero', () => {
  assert.equal(calculateCost('claude-sonnet-4-6', 0, 0), 0);
});

test('fractional token cost precision', () => {
  const cost = calculateCost('claude-haiku-4-5-20251001', 500, 200);
  const expected = (500 / 1_000_000) * 0.80 + (200 / 1_000_000) * 4.00;
  assert.equal(cost, expected);
});

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
