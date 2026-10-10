"""Render benchmark results (runner output dict) as Markdown."""


def render(out: dict) -> str:
    runs = {r["defense_mode"]: r for r in out["runs"]}
    base = runs.get("baseline")
    lines = ["# Prompt Injection Benchmark", "", f"Model: `{out['model']}`"]
    if out.get("is_mock"):
        lines += ["", "> ⚠️ Produced with the deterministic **mock** model: validates the harness, "
                      "not a real model's robustness."]
    lines += ["", "| Defense mode | ASR % ↓ | FPR % ↓ | Detection % ↑ | Avg latency ms | Tokens | ASR Δ vs baseline | Token overhead |",
              "|---|---|---|---|---|---|---|---|"]
    for mode, r in runs.items():
        asr_delta = f"{r['attack_success_rate'] - base['attack_success_rate']:+.1f} pts" if base and mode != "baseline" else "—"
        tok = f"{100 * (r['total_tokens'] / base['total_tokens'] - 1):+.1f}%" if base and mode != "baseline" and base["total_tokens"] else "—"
        det = "—" if r["detection_accuracy"] is None else f"{r['detection_accuracy']:.1f}"
        lines.append(f"| {mode} | {r['attack_success_rate']:.1f} | {r['false_positive_rate']:.1f} | {det} | "
                     f"{r['avg_latency_ms']} | {r['total_tokens']:,} | {asr_delta} | {tok} |")
    vectors = sorted({v for r in runs.values() for v in r["asr_by_vector"]})
    if vectors:
        lines += ["", "## ASR % by attack vector", "", "| Vector | " + " | ".join(runs) + " |",
                  "|---|" + "---|" * len(runs)]
        lines += [f"| {v} | " + " | ".join(f"{r['asr_by_vector'].get(v, 0):.1f}" for r in runs.values()) + " |" for v in vectors]
    return "\n".join(lines) + "\n"

