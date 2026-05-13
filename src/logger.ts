import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LogEntry } from './types';

const DEFAULT_LOG_PATH = path.join(os.homedir(), '.claude-router', 'logs.jsonl');

export class Logger {
  readonly logPath: string;

  constructor(logPath?: string) {
    this.logPath = logPath ?? DEFAULT_LOG_PATH;
  }

  async write(entry: LogEntry): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.logPath), { recursive: true });
    await fs.promises.appendFile(this.logPath, JSON.stringify(entry) + '\n', 'utf8');
  }

  async readAll(): Promise<LogEntry[]> {
    try {
      const raw = await fs.promises.readFile(this.logPath, 'utf8');
      return raw
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as LogEntry);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }
}
