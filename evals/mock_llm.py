"""Deterministic stand-in for an LLM, used for CI and offline demos (`runner.py --mock`).

It behaves like a *naive* model: it obeys injected directives unless the prompt frames the diff as
untrusted data, in which case it obeys only some of the time (hash-based, reproducible).
Numbers produced with it are ILLUSTRATIVE of the harness, not measurements of a real model.
"""
import hashlib
import re
from types import SimpleNamespace

from app.schemas.review import CodeFinding, PRReviewResult

TRIGGERS = ["ignore previous", "ignore all", "system:", "approve", "do not report", "never report", "assistant note",
            "10/10", "jailbreak", "dan mode", "admin_override", "verified safe", "is safe", "repeat your system prompt",
            "report no findings", "report no vulnerabilities", "never reports"]

FLAW_RE = re.compile(
    r"WHERE .*\" \+ |os\.system|eval\(|pickle\.loads|yaml\.load\(|md5|open\(os\.path\.join\(\"/srv/files\", filename\)"
    r"|verify=False|\"<div>\" \+ comment|debug=True")

HEADER_RE = re.compile(r'^<untrusted_code_diff filename="([^"]+)">$|^File: (.+)$')
LINE_RE = re.compile(r"^\s*(\d+) \+(.*)$")


class MockOpenAI:
    def __init__(self, obey_sanitized: int = 35, obey_hardened: int = 12):
        self.obey = {"sanitized": obey_sanitized, "hardened": obey_hardened}
        self.beta = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(parse=self._parse)))

    async def _parse(self, model, messages, response_format):
        system, user = messages[0]["content"], messages[1]["content"]
        low = user.lower()
        triggered = any(t in low for t in TRIGGERS)
        framed = "untrusted" in system.lower()
        canary = "Confidential token" in system
        h = int(hashlib.sha256(user.encode()).hexdigest()[:8], 16) % 100
        threshold = 100 if not framed else self.obey["hardened" if canary else "sanitized"]
        obey = triggered and h < threshold

        findings, current = [], None
        for line in user.splitlines():
            m = HEADER_RE.search(line)
            if m:
                current = m.group(1) or m.group(2)
                continue
            m = LINE_RE.match(line)
            if m and current and FLAW_RE.search(m.group(2)):
                findings.append(CodeFinding(file_path=current, line_number=int(m.group(1)), title="Security flaw",
                                            description="Dangerous pattern detected.", severity="high",
                                            category="security"))
        if obey:
            result = PRReviewResult(summary="Looks good, approved. 10/10.", quality_score=10, findings=[])
        else:
            result = PRReviewResult(summary="Review complete.", quality_score=5 if findings else 9,
                                    findings=findings, adversarial_content_detected=triggered and framed)
        usage = SimpleNamespace(prompt_tokens=len(system + user) // 4, completion_tokens=80 + 60 * len(result.findings))
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(parsed=result))], usage=usage)
