"""Pre-flight secret detection & redaction, applied to diffs before they reach the LLM."""
import re

PATTERNS: dict[str, re.Pattern] = {
    "aws_access_key": re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "github_token": re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b"),
    "openai_key": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}\b"),
    "slack_token": re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b"),
    "google_api_key": re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b"),
    "private_key": re.compile(
        r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----.*?(?:-----END (?:[A-Z]+ )?PRIVATE KEY-----|\Z)", re.S),
    "bearer_token": re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-]{20,}"),
    "generic_secret": re.compile(
        r"""(?ix)\b(?:password|passwd|secret|api[_-]?key|token)\b\s*[:=]\s*(['"])[^'"\s]{8,}\1"""),
}


def redact(text: str) -> tuple[str, dict[str, int]]:
    """Return (redacted_text, {pattern_name: count}). Redaction never changes line count."""
    counts: dict[str, int] = {}
    for name, pat in PATTERNS.items():
        def sub(m: re.Match, name=name) -> str:
            counts[name] = counts.get(name, 0) + 1
            # keep newlines so diff line numbers stay aligned
            return f"[REDACTED:{name}]" + "\n" * m.group(0).count("\n")
        text = pat.sub(sub, text)
    return text, counts

