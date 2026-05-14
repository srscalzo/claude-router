# Claude Router

Automatic cost optimization and routing layer for the Anthropic Claude API.

Routes every prompt to the cheapest Claude model likely to succeed, escalates if the response is insufficient, and tracks your savings over time.

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
4. **Log** — Appends a JSONL record to `~/.claude-router/logs.jsonl` with model, tokens, latency, cost, and escalation count.

---

## Requirements

- Node.js 18 or later
- An [Anthropic API key](https://console.anthropic.com/)

---

## Installation

```bash
npm install claude-router
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
import { ClaudeRouter } from 'claude-router';

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
import { ClaudeRouter } from 'claude-router';
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
  logPath?: string;           // JSONL log file path (default: ~/.claude-router/logs.jsonl)
});
```

---

## Cost Analytics CLI

After making some requests, view your savings:

```bash
npx claude-router stats

# or, if installed globally / in a project:
claude-router stats
```

Example output:

```
 Claude Router — Cost Analytics
────────────────────────────────────────────────────────
  Total requests:              42
  Actual cost:                 $0.0031
  Est. cost (always Sonnet):   $0.0089
  Est. cost (always Opus):     $0.0441
────────────────────────────────────────────────────────
  Savings vs Sonnet:           $0.0058 (65.2%)
  Savings vs Opus:             $0.0410 (93.0%)
────────────────────────────────────────────────────────
  Model distribution:
    claude-haiku-4-5-20251001:   35 (83.3%)
    claude-sonnet-4-6:            6 (14.3%)
    claude-opus-4-7:              1 (2.4%)
────────────────────────────────────────────────────────
  Avg latency:                 412 ms
────────────────────────────────────────────────────────
```

Use a custom log path:

```bash
claude-router stats --log-path /path/to/logs.jsonl
```

---

## Log Format

Each request appends one JSON line to `~/.claude-router/logs.jsonl`:

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
  "cost_usd": 0.000598,
  "prompt_tier": 1
}
```

You can pipe it to `jq` for custom queries:

```bash
# Average cost per request
jq -s '[.[].cost_usd] | add / length' ~/.claude-router/logs.jsonl

# All escalated requests
jq 'select(.escalations > 0)' ~/.claude-router/logs.jsonl
```

---

## Model Pricing

| Model | Input | Output |
|---|---|---|
| `claude-haiku-4-5-20251001` | $0.80 / M tokens | $4.00 / M tokens |
| `claude-sonnet-4-6` | $3.00 / M tokens | $15.00 / M tokens |
| `claude-opus-4-7` | $15.00 / M tokens | $75.00 / M tokens |

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
├── pricing.ts      # model pricing + escalation chain
├── logger.ts       # JSONL file writer
├── router.ts       # ClaudeRouter class
└── cli/
    ├── index.ts    # CLI entrypoint (claude-router stats)
    └── stats.ts    # analytics aggregator + formatter
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
