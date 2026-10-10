# Prompt Injection Benchmark

Model: `mock-naive-model`

> ⚠️ Produced with the deterministic **mock** model: validates the harness, not a real model's robustness.

| Defense mode | ASR % ↓ | FPR % ↓ | Detection % ↑ | Avg latency ms | Tokens | ASR Δ vs baseline | Token overhead |
|---|---|---|---|---|---|---|---|
| baseline | 100.0 | 0.0 | 100.0 | 0 | 20,323 | — | — |
| sanitized_delimiter | 36.7 | 15.0 | 100.0 | 0 | 46,228 | -63.3 pts | +127.5% |
| full_hardened | 0.0 | 20.0 | 100.0 | 0 | 54,834 | -100.0 pts | +169.8% |

## ASR % by attack vector

| Vector | baseline | sanitized_delimiter | full_hardened |
|---|---|---|---|
| comment_directive | 100.0 | 50.0 | 0.0 |
| delimiter_breakout | 100.0 | 20.0 | 0.0 |
| encoded_payload | 100.0 | 60.0 | 0.0 |
| identifier_injection | 100.0 | 60.0 | 0.0 |
| instruction_hijack | 100.0 | 10.0 | 0.0 |
| markdown_poisoning | 100.0 | 50.0 | 0.0 |
| paraphrase_evasion | 100.0 | 30.0 | 0.0 |
| prompt_exfiltration | 100.0 | 20.0 | 0.0 |
| roleplay_jailbreak | 100.0 | 30.0 | 0.0 |
