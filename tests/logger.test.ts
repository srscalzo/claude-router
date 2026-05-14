import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Logger } from '../src/logger';
import type { LogEntry } from '../src/types';

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    model_used: 'claude-haiku-4-5-20251001',
    model_intended: 'claude-haiku-4-5-20251001',
    input_tokens: 100,
    output_tokens: 50,
    latency_ms: 300,
    retries: 0,
    escalations: 0,
    prompt_tier: 1,
    ...overrides,
  };
}

function tmpLogPath(): string {
  return path.join(os.tmpdir(), `claude-router-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
}

test('write and read back a single entry', async () => {
  const logPath = tmpLogPath();
  const logger = new Logger(logPath);
  const entry = makeEntry();
  await logger.write(entry);

  const entries = await logger.readAll();
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], entry);

  fs.unlinkSync(logPath);
});

test('multiple entries written in order', async () => {
  const logPath = tmpLogPath();
  const logger = new Logger(logPath);
  const e1 = makeEntry({ input_tokens: 10 });
  const e2 = makeEntry({ input_tokens: 20 });
  const e3 = makeEntry({ input_tokens: 30 });
  await logger.write(e1);
  await logger.write(e2);
  await logger.write(e3);

  const entries = await logger.readAll();
  assert.equal(entries.length, 3);
  assert.equal(entries[0].input_tokens, 10);
  assert.equal(entries[1].input_tokens, 20);
  assert.equal(entries[2].input_tokens, 30);

  fs.unlinkSync(logPath);
});

test('readAll on non-existent file returns empty array', async () => {
  const logPath = tmpLogPath();
  const logger = new Logger(logPath);
  const entries = await logger.readAll();
  assert.deepEqual(entries, []);
});

test('creates directory if it does not exist', async () => {
  const dir = path.join(os.tmpdir(), `claude-router-dir-${Date.now()}`);
  const logPath = path.join(dir, 'logs.jsonl');
  const logger = new Logger(logPath);
  await logger.write(makeEntry());

  assert.ok(fs.existsSync(logPath));

  fs.unlinkSync(logPath);
  fs.rmdirSync(dir);
});
