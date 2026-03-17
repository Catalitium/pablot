# Token Counter

Offline token and cost estimator.

## Features
- Live char, word, line, and token estimation.
- Model selector with context window and input pricing assumptions.
- Context usage percent with threshold warnings.
- Deterministic local calculations only.

## Limits
- Token counting is approximate (`chars / 4`) and not tokenizer-accurate.
- Pricing values are static defaults for estimation.
- Unknown model selection falls back to `local-default` in script logic.
