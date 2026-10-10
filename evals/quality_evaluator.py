"""AI Review Quality & Reliability Evaluator:
Calculates:
- Precision: TP / (TP + FP)
- Recall: TP / (TP + FN)
- F1 Score: 2 * (Precision * Recall) / (Precision + Recall)
- False Positive Rate: FP / (FP + TN)
- Model vs Model comparison (gpt-4o vs gpt-4o-mini / mock)
- Prompt regression tracking via fingerprint

Usage (from backend/):
    .venv/bin/python ../evals/quality_evaluator.py --mock --save-db
"""
import argparse
import asyncio
import hashlib
import json
import sys
import time
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))
sys.path.insert(0, str(ROOT.parent))

from app.config import get_settings
from app.services.diff_parser import build_file_diffs
from app.services.reviewer import review_diffs

DATASET_FILE = ROOT / "datasets" / "evaluation_suite_100.json"


def prompt_fingerprint(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:12]


async def evaluate_model(model_name: str, client, is_mock: bool = False, limit: int = 0) -> dict:
    cases = json.loads(DATASET_FILE.read_text())
    if limit > 0:
        cases = cases[:limit]

    settings = get_settings()

    tp = 0  # Vulnerability exists and was caught
    fp = 0  # Benign code falsely flagged as vulnerable
    fn = 0  # Vulnerability exists but was missed
    tn = 0  # Benign code correctly passed clean

    total_tokens = 0
    latencies = []
    t_start = time.monotonic()

    for tc in cases:
        diffs = build_file_diffs(tc["files"])
        t0 = time.monotonic()
        try:
            result, p_tok, c_tok = await review_diffs(
                tc["description"], diffs, settings, client=client, model=model_name
            )
            latencies.append((time.monotonic() - t0) * 1000)
            total_tokens += (p_tok + c_tok)
            flagged = len(result.findings) > 0 or result.adversarial_content_detected
        except Exception:
            flagged = False

        has_vuln = tc["has_vulnerability"]

        if has_vuln and flagged:
            tp += 1
        elif not has_vuln and flagged:
            fp += 1
        elif has_vuln and not flagged:
            fn += 1
        else:
            tn += 1

    duration_ms = int((time.monotonic() - t_start) * 1000)
    avg_latency = int(sum(latencies) / len(latencies)) if latencies else 0

    precision = round((tp / (tp + fp) * 100), 2) if (tp + fp) > 0 else 0.0
    recall = round((tp / (tp + fn) * 100), 2) if (tp + fn) > 0 else 0.0
    f1 = round((2 * precision * recall / (precision + recall)), 2) if (precision + recall) > 0 else 0.0
    fpr = round((fp / (fp + tn) * 100), 2) if (fp + tn) > 0 else 0.0

    # Approx cost calculation based on token estimates
    cost = round((total_tokens * 0.0000004), 5)

    from app.services.injection_guard import HARDENED_SYSTEM
    fp_print = prompt_fingerprint(HARDENED_SYSTEM)

    return {
        "model_name": model_name,
        "dataset_size": len(cases),
        "flawed_cases": tp + fn,
        "benign_cases": fp + tn,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "false_positive_rate": fpr,
        "avg_latency_ms": avg_latency,
        "total_tokens": total_tokens,
        "cost_usd": cost,
        "prompt_fingerprint": fp_print,
        "duration_ms": duration_ms,
        "is_mock": is_mock
    }


async def save_quality_to_db(metrics: dict):
    from app.db.models import EvalQualityRun
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        s.add(EvalQualityRun(
            model_name=metrics["model_name"],
            dataset_size=metrics["dataset_size"],
            flawed_cases=metrics["flawed_cases"],
            benign_cases=metrics["benign_cases"],
            tp=metrics["tp"],
            fp=metrics["fp"],
            fn=metrics["fn"],
            precision=Decimal(str(metrics["precision"])),
            recall=Decimal(str(metrics["recall"])),
            f1=Decimal(str(metrics["f1"])),
            false_positive_rate=Decimal(str(metrics["false_positive_rate"])),
            avg_latency_ms=metrics["avg_latency_ms"],
            total_tokens=metrics["total_tokens"],
            cost_usd=Decimal(str(metrics["cost_usd"])),
            prompt_fingerprint=metrics["prompt_fingerprint"],
            is_mock=metrics["is_mock"]
        ))
        await s.commit()


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mock", action="store_true", help="Use deterministic mock reviewer")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of cases")
    parser.add_argument("--save-db", action="store_true", help="Store run in database")
    args = parser.parse_args()

    client = None
    if args.mock:
        from evals.mock_llm import MockOpenAI
        # Mocking 2 models: standard fast vs deeper reasoning
        client_mini = MockOpenAI(obey_sanitized=30, obey_hardened=10)
        client_strong = MockOpenAI(obey_sanitized=10, obey_hardened=2)

        print("Running Quality Evaluation Suite on mock-gpt-4o-mini (105 test cases)...")
        res_mini = await evaluate_model("mock-gpt-4o-mini", client_mini, is_mock=True, limit=args.limit)

        print("Running Quality Evaluation Suite on mock-gpt-4o (105 test cases)...")
        res_strong = await evaluate_model("mock-gpt-4o", client_strong, is_mock=True, limit=args.limit)

        for res in [res_mini, res_strong]:
            print(f"\n================ Model: {res['model_name']} ================")
            print(f"Scenarios Evaluated: {res['dataset_size']} ({res['flawed_cases']} flawed, {res['benign_cases']} benign)")
            print(f"Precision: {res['precision']}% | Recall: {res['recall']}% | F1 Score: {res['f1']}%")
            print(f"False Positive Rate: {res['false_positive_rate']}%")
            print(f"Tokens: {res['total_tokens']:,} | Cost: ${res['cost_usd']:.5f}")
            print(f"Prompt Fingerprint: {res['prompt_fingerprint']}")

            if args.save_db:
                await save_quality_to_db(res)
        if args.save_db:
            print("\nSaved evaluation comparison to database successfully.")
    else:
        settings = get_settings()
        if not settings.openai_api_key:
            sys.exit("OPENAI_API_KEY is not set. Use --mock for offline demo.")
        print(f"Running Quality Evaluation Suite on {settings.openai_model}...")
        res = await evaluate_model(settings.openai_model, None, is_mock=False, limit=args.limit)
        print(json.dumps(res, indent=2))
        if args.save_db:
            await save_quality_to_db(res)


if __name__ == "__main__":
    asyncio.run(main())

