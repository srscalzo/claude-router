# Claude Router

Automatic model routing and token tracking for the Anthropic Claude API.

Routes every prompt to the cheapest Claude model likely to succeed, escalates if the response is insufficient, and tracks usage over time.

> **Target savings: 20–40% on Claude API spend with no code changes beyond the import.**

---

## How It Works

```
Your prompt
    │
    ▼
┌─────────────┐     score < 2    ┌─────────────────────────┐
│  Classifier │ ───────────────► │  Haiku  (Tier 1 — fast) │
│  (heuristic)│     score 2–3    ├─────────────────────────┤
│             │ ───────────────► │  Sonnet (Tier 2 — smart)│
│             │     score ≥ 4    ├─────────────────────────┤
└─────────────┘ ───────────────► │  Opus   (Tier 3 — best) │
                                 └─────────────────────────┘
                                           │
                          Response too short / uncertain?
                                           │ yes
                                           ▼
                                    Escalate to next tier
                                           │
                                           ▼
                                    Log result to JSONL
```

1. **Classify** — Scores the prompt using heuristics: token count, code blocks, complexity keywords (`architect`, `refactor`, `optimize`, …), conversation length, and system prompt size.
2. **Route** — Picks the cheapest model for the score: Haiku → Sonnet → Opus.
3. **Escalate** — If the response looks insufficient (too short, contains uncertainty phrases like "I'm not sure"), retries with the next model up.
4. **Log** — Appends a JSONL record to `~/.clauderouter/logs.jsonl` with model, tokens, latency, and escalation count.

---

## Requirements

- Node.js 18 or later
- An [Anthropic API key](https://console.anthropic.com/)

---

## Installation

```bash
npm install clauderouter
```

---

## Setup

Set your API key as an environment variable:

```bash
# .env or shell profile
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or pass it directly to the constructor (see usage below).

---

## Usage

### Basic — automatic routing

```typescript
import { ClaudeRouter } from 'clauderouter';

const router = new ClaudeRouter({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const response = await router.run({
  messages: [{ role: 'user', content: 'What is 2 + 2?' }],
  max_tokens: 100,
});

console.log(response.content[0].text);
// → "4"
// Used Haiku automatically — costs ~18× less than Opus
```

`router.run()` is a drop-in replacement for `client.messages.create()`. It returns the same `Anthropic.Message` type, so no downstream changes are needed.

### Migrating from the Anthropic SDK

```typescript
// Before
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  messages: [...],
  max_tokens: 1024,
});

// After — delete the model field, swap the import
import { ClaudeRouter } from 'clauderouter';
const router = new ClaudeRouter({ apiKey: process.env.ANTHROPIC_API_KEY! });
const response = await router.run({
  //  model: 'claude-sonnet-4-6',  ← remove this line
  messages: [...],
  max_tokens: 1024,
});
```

### Force a specific model

When you know which model you need, pass `model` explicitly — the classifier is skipped:

```typescript
const response = await router.run({
  messages: [{ role: 'user', content: 'Redesign our entire auth system.' }],
  max_tokens: 4096,
  model: 'claude-opus-4-7',
});
```

### With tools

All Anthropic SDK parameters are supported:

```typescript
const response = await router.run({
  messages: [{ role: 'user', content: 'What files are in the current directory?' }],
  max_tokens: 1024,
  tools: [
    {
      name: 'list_files',
      description: 'List files in a directory',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  ],
});
```

### Multi-turn conversation

```typescript
const messages: Anthropic.MessageParam[] = [];

messages.push({ role: 'user', content: 'Explain closures in JavaScript.' });
const first = await router.run({ messages, max_tokens: 512 });

messages.push({ role: 'assistant', content: first.content });
messages.push({ role: 'user', content: 'Now show me a practical example.' });
const second = await router.run({ messages, max_tokens: 512 });
```

---

## Configuration

```typescript
const router = new ClaudeRouter({
  apiKey: string;             // required — your Anthropic API key

  maxRetries?: number;        // max escalation/retry attempts (default: 2)
  disableEscalation?: boolean;// skip escalation checks entirely (default: false)
  logPath?: string;           // JSONL log file path (default: ~/.clauderouter/logs.jsonl)
});
```

---

## CLI

Install globally or use `npx`:

```bash
npm install -g clauderouter
# or
npx clauderouter <command>
```

### `ask` — one-shot query

```bash
claude-router ask "What is the time complexity of quicksort?"

# Force a specific model
claude-router ask "Refactor this service layer" --model claude-opus-4-7

# Custom log path
claude-router ask "Hello" --log-path ./my-logs.jsonl
```

Output goes to stdout; metadata (model, tokens, latency) goes to stderr so you can pipe responses cleanly:

```bash
claude-router ask "Write a haiku about Go channels" > haiku.txt
```

### `chat` — interactive session

Starts a persistent session with your project's file tree injected as a cached system prompt. Context is sent once and cached by Anthropic for 5 minutes — subsequent turns cost ~10% of the first turn's price.

```bash
claude-router chat

# Skip context injection
claude-router chat --no-context

# Force a model for all turns
claude-router chat --model claude-sonnet-4-6
```

Type `exit` or `quit` to end the session. A summary of models used and total tokens is printed on exit.

### `stats` — usage analytics

```bash
claude-router stats

# Custom log path
claude-router stats --log-path ./my-logs.jsonl
```

Example output:

```
 Claude Router — Usage Analytics
────────────────────────────────────────────────────────
  Total requests:              42
  Total input tokens:          18,432
  Total output tokens:          3,891
────────────────────────────────────────────────────────
  Model distribution:
    claude-haiku-4-5-20251001:   35 (83.3%)
    claude-sonnet-4-6:            6 (14.3%)
    claude-opus-4-7:              1 (2.4%)
────────────────────────────────────────────────────────
  Total escalations:           3
  Avg latency:                 412 ms
────────────────────────────────────────────────────────
```

---

## Log Format

Each request appends one JSON line to `~/.clauderouter/logs.jsonl`:

```json
{
  "timestamp": "2026-05-13T10:22:01.443Z",
  "model_used": "claude-haiku-4-5-20251001",
  "model_intended": "claude-haiku-4-5-20251001",
  "input_tokens": 312,
  "output_tokens": 87,
  "latency_ms": 408,
  "retries": 0,
  "escalations": 0,
  "prompt_tier": 1
}
```

You can pipe it to `jq` for custom queries:

```bash
# All escalated requests
jq 'select(.escalations > 0)' ~/.clauderouter/logs.jsonl

# Average latency
jq -s '[.[].latency_ms] | add / length' ~/.clauderouter/logs.jsonl

# Model distribution
jq -r '.model_used' ~/.clauderouter/logs.jsonl | sort | uniq -c | sort -rn
```

---

## Development

```bash
git clone https://github.com/srscalzo/claude-router.git
cd claude-router
npm install

npm test          # run all tests
npm run lint      # type-check without building
npm run build     # compile to dist/
```

### Project structure

```
src/
├── index.ts        # public API barrel
├── types.ts        # shared interfaces
├── classifier.ts   # heuristic complexity scorer
├── escalation.ts   # response quality checker
├── pricing.ts      # model routing + escalation chain
├── logger.ts       # JSONL file writer
├── router.ts       # ClaudeRouter class
└── cli/
    ├── index.ts    # CLI entrypoint
    ├── ask.ts      # one-shot query command
    ├── chat.ts     # interactive session command
    ├── stats.ts    # analytics aggregator + formatter
    ├── context.ts  # project file tree builder
    └── spinner.ts  # terminal animation
tests/
├── classifier.test.ts
├── escalation.test.ts
├── pricing.test.ts
├── logger.test.ts
└── router.test.ts
```

---

## License

MIT
