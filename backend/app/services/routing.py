"""Cost-aware model routing: cheap model for small/low-risk PRs, strong model for risky ones."""
import re
from dataclasses import dataclass

from app.config import Settings
from app.schemas.rules import OrgPolicy
from app.services.diff_parser import FileDiff
from app.services.injection_guard import detect_injection

# USD per 1M tokens (input, output)
PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1": (2.00, 8.00),
}

RISKY_PATH = re.compile(r"auth|login|session|crypto|payment|billing|secret|security|permission|acl|iam|migration"
                        r"|\.sql$|dockerfile|terraform|\.tf$|\.github/workflows", re.I)
SMALL_PR_MAX_LINES = 80
LARGE_PR_MIN_LINES = 300


def price(model: str, settings: Settings) -> tuple[float, float]:
    return PRICING.get(model, (settings.price_input_per_mtok, settings.price_output_per_mtok))


def cost_usd(model: str, prompt_tokens: int, completion_tokens: int, settings: Settings) -> float:
    pin, pout = price(model, settings)
    return round(prompt_tokens / 1e6 * pin + completion_tokens / 1e6 * pout, 5)


def changed_lines(diffs: list[FileDiff]) -> int:
    return sum(1 for d in diffs for l in d.patch.splitlines() if l.startswith("+") and not l.startswith("+++"))


@dataclass
class Route:
    model: str
    reason: str


def choose_model(diffs: list[FileDiff], redactions: int, policy: OrgPolicy, settings: Settings) -> Route:
    cheap = policy.cheap_model or settings.cheap_model
    strong = policy.strong_model or settings.strong_model
    if not policy.routing_enabled:
        return Route(settings.openai_model, "routing disabled")
    n = changed_lines(diffs)
    risky = [d.path for d in diffs if RISKY_PATH.search(d.path)]
    if risky:
        return Route(strong, f"risky path: {risky[0]}")
    if redactions:
        return Route(strong, f"{redactions} secret(s) in diff")
    if any(detect_injection(d.patch) for d in diffs):
        return Route(strong, "possible prompt injection")
    if n >= LARGE_PR_MIN_LINES:
        return Route(strong, f"large change ({n} lines)")
    if n <= SMALL_PR_MAX_LINES:
        return Route(cheap, f"small, low-risk change ({n} lines)")
    return Route(settings.openai_model, f"medium change ({n} lines)")

