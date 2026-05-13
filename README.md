# Claude Router

Automatic cost optimization and routing layer for the Anthropic Claude API.

Routes prompts to the cheapest Claude model likely to succeed, falls back if needed, and tracks your savings.

## Install

```bash
npm install claude-router
```

## Usage

```typescript
import { ClaudeRouter } from 'claude-router';

const router = new ClaudeRouter({ apiKey: process.env.ANTHROPIC_API_KEY });

// Drop-in replacement for client.messages.create()
// The router selects the model automatically based on prompt complexity.
const response = await router.run({
  messages: [{ role: 'user', content: 'What is 2 + 2?' }],
  max_tokens: 100,
});

console.log(response.content[0].text);
```

The return type is `Anthropic.Message` — identical to what `client.messages.create()` returns.

## How It Works

1. **Classify** — Heuristics score prompt complexity (length, code blocks, keywords, history length).
2. **Route** — Maps score to cheapest model: Haiku (simple) → Sonnet (moderate) → Opus (complex).
3. **Escalate** — If the response looks insufficient (too short, uncertainty phrases), retries with next-tier model.
4. **Log** — Records every request to `~/.claude-router/logs.jsonl`.

## Options

```typescript
const router = new ClaudeRouter({
  apiKey: string;           // required
  maxRetries?: number;      // default: 2
  disableEscalation?: boolean; // default: false
  logPath?: string;         // default: ~/.claude-router/logs.jsonl
});
```

## Force a Model

```typescript
// Skip routing — use a specific model directly
const response = await router.run({
  messages: [...],
  max_tokens: 1024,
  model: 'claude-opus-4-7',
});
```

## Cost Analytics

After running some requests, view your savings:

```bash
npx claude-router stats
```

Output:
```
 Claude Router — Cost Analytics
────────────────────────────────────────────────────
  Total requests:              42
  Actual cost:                 $0.0031
  Est. cost (always Sonnet):   $0.0089
  Est. cost (always Opus):     $0.0441
────────────────────────────────────────────────────
  Savings vs Sonnet:           $0.0058 (65.2%)
  Savings vs Opus:             $0.0410 (93.0%)
────────────────────────────────────────────────────
  Model distribution:
    claude-haiku-4-5-20251001:   35 (83.3%)
    claude-sonnet-4-6:            6 (14.3%)
    claude-opus-4-7:              1 (2.4%)
────────────────────────────────────────────────────
  Avg latency:                 412 ms
```

## Pricing (as of May 2026)

| Model | Input | Output |
|---|---|---|
| claude-haiku-4-5-20251001 | $0.80 / M tokens | $4.00 / M tokens |
| claude-sonnet-4-6 | $3.00 / M tokens | $15.00 / M tokens |
| claude-opus-4-7 | $15.00 / M tokens | $75.00 / M tokens |

## License

MIT
