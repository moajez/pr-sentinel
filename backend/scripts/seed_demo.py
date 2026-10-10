"""Seed the database with realistic reviews and enterprise governance metadata.

Usage (from backend/):  .venv/bin/python -m scripts.seed_demo [--reset]
"""
import asyncio
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete

from app.db import models
from app.db.session import AsyncSessionLocal
from app.services import audit
from app.services.compliance import classify

REPOS = [(9001, "acme/payments-api", "Payments Infrastructure"), (9002, "acme/web-frontend", "Core Web Application")]

FINDINGS_POOL = [
    ("src/db/queries.py", "Potential SQL injection", "User input is concatenated into the SQL string without parameterized binding.", "critical", "security",
     'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))', "CWE-89"),
    ("src/auth/login.py", "Missing rate limiting on login", "Unlimited attempts allow automated credential stuffing.", "high", "security", 'limiter.limit("5/minute")(login_endpoint)', "CWE-307"),
    ("src/api/orders.py", "N+1 query in order listing", "A database query runs per order inside the loop; use a joined eager load.", "medium", "performance", None, "CWE-400"),
    ("src/utils/cache.py", "Race condition on cache refresh", "Two concurrent workers can refresh simultaneously; acquire a distributed lock.", "medium", "bug", None, "CWE-362"),
    ("src/api/orders.py", "No unit tests for refund path", "The new refund branch has no automated test coverage.", "low", "missing_tests", None, None),
    ("src/models/user.py", "Inconsistent naming", "Mixed camelCase and snake_case.", "info", "code_style", None, None),
    ("web/src/Form.tsx", "dangerouslySetInnerHTML with user content", "Unsanitized HTML enables cross-site scripting (XSS).", "high", "security", 'DOMPurify.sanitize(userContent)', "CWE-79"),
    ("src/crypto/token.py", "Weak cryptographic hash MD5", "MD5 is collision vulnerable; upgrade to SHA-256.", "high", "security", 'hashlib.sha256(data).hexdigest()', "CWE-328"),
    ("src/storage/upload.py", "Path traversal vulnerability", "User supplied path joined directly without basename validation.", "high", "security", 'os.path.basename(user_path)', "CWE-22"),
]

PRS_CONFIG = [
    # (num, repo_idx, title, author, status, specific_findings, special_mode)
    (201, 0, "Add direct transaction processor", "alice", "completed", [0, 1], "blocked"),
    (108, 1, "Fix typo in README", "carol", "completed", [], "clean"),
    (107, 0, "Add CSV export", "bob", "completed", [0, 2, 7, 8], "blocked_injection"),
    (104, 1, "Upgrade dependencies", "dave", "failed_provider", [], "failed"),
    (203, 0, "Update payment webhook schemas", "bob", "queued", [], "queued"),
    (204, 1, "Refactor authentication gateway", "erin", "failed_timeout", [], "failed"),
    (205, 0, "Hotfix: Stripe API webhook signature mismatch", "alice", "completed", [1], "exception_approved"),
    (101, 0, "Add refund endpoint", "alice", "completed", [0, 2], "blocked"),
    (102, 1, "Fix login redirect", "bob", "completed", [3], "permitted"),
    (103, 0, "Speed up order list", "carol", "completed", [2, 4], "permitted"),
    (105, 1, "Add user profile form", "erin", "completed", [6], "blocked"),
    (106, 0, "Refactor cache layer", "alice", "completed", [3], "permitted"),
]


async def main(reset: bool) -> None:
    random.seed(42)
    async with AsyncSessionLocal() as s:
        if reset:
            for m in (models.AuditLog, models.Finding, models.Review, models.PullRequest, models.Repository, models.Membership, models.User, models.Installation):
                await s.execute(delete(m))

        policy = {
            "monthly_budget_usd": 50.0,
            "team_budgets": {"Payments Infrastructure": 30.0, "Core Web Application": 20.0},
            "enforce_budget": True,
            "alert_threshold_pct": 80,
            "routing_enabled": True,
            "allow_auto_fix": True
        }
        inst = models.Installation(id=500, account_login="acme", account_type="Organization", policy=policy)
        s.add(inst)
        await s.flush()

        # Seed Users and Enterprise RBAC Memberships
        users_roles = [
            ("alice", "admin"),
            ("bob", "security_reviewer"),
            ("carol", "developer"),
            ("dan_auditor", "auditor"),
        ]
        for username, role_name in users_roles:
            u = models.User(github_login=username)
            s.add(u)
            await s.flush()
            s.add(models.Membership(user_id=u.id, installation_id=500, role=role_name))
        await s.flush()

        for rid, name, team in REPOS:
            repo_settings = {
                "min_severity": "info",
                "exclude_paths": ["dist/**", "node_modules/**"],
                "rules": [
                    {"name": "No Hardcoded Secrets", "enabled": True, "severity": "critical"},
                    {"name": "SQL Parameterization", "enabled": True, "severity": "critical"},
                    {"name": "Enforce Input Validation", "enabled": True, "severity": "high"},
                ],
                "block_severity": "high",
                "min_quality_score": 7,
                "block_on_unresolved_cwe": ["CWE-89", "CWE-79", "CWE-307"],
                "team": team,
                "auto_fix_pr": True,
                "enforcement_mode": "enforce",
                "auto_fix_behavior": "draft_pr",
                "require_check": True,
                "fail_open": False,
                "paused": False,
            }
            s.add(models.Repository(
                id=rid,
                installation_id=500,
                full_name=name,
                settings=repo_settings,
                branch_protection_enforced=True
            ))
        await s.flush()

        now = datetime.now(timezone.utc)
        for i, (num, repo_idx, title, author, st_type, find_indices, mode) in enumerate(PRS_CONFIG):
            repo_id, repo_name, team_name = REPOS[repo_idx]
            pr = models.PullRequest(
                repository_id=repo_id,
                pr_number=num,
                title=title,
                author=author,
                head_sha=uuid.uuid4().hex[:40],
                base_sha=uuid.uuid4().hex[:40]
            )
            s.add(pr)
            await s.flush()

            p_tok = random.randint(3200, 8400)
            c_tok = random.randint(450, 1100)
            picked = [FINDINGS_POOL[idx] for idx in find_indices]

            model_routed = "gpt-4o" if (mode in ("blocked", "blocked_injection") or len(picked) >= 3) else "gpt-4o-mini"
            routing_reason = "high security risk / security critical path" if model_routed == "gpt-4o" else "routine code change"

            blocking = [p for p in picked if p[3] in ("critical", "high")]
            violations = []
            if blocking:
                violations.append(f"Found {len(blocking)} Critical/High finding(s) violating 'high' threshold")
            if mode == "blocked_injection":
                violations.append("Adversarial prompt injection attempt detected")

            # Determine quality score and review status
            if st_type == "failed_provider":
                status = "failed"
                quality = None
                err_msg = "AI provider unavailable (API rate limit exceeded); retry available"
                latency = 1850
                merge_blocked = False
                p_tok, c_tok = 0, 0
            elif st_type == "failed_timeout":
                status = "failed"
                quality = None
                err_msg = "Model inference timed out after 30000ms; retry available"
                latency = 30000
                merge_blocked = False
                p_tok, c_tok = 0, 0
            elif st_type == "queued":
                status = "pending"
                quality = None
                err_msg = None
                latency = 0
                merge_blocked = False
                p_tok, c_tok = 0, 0
            else:
                status = "completed"
                err_msg = None
                latency = random.randint(3400, 11800)
                quality = 10 if not picked else (5 if blocking else 8)
                if quality < 7:
                    violations.append(f"Quality score {quality}/10 is below required minimum threshold 7/10")
                merge_blocked = len(violations) > 0

            # Exception handling
            exception_detail = None
            if mode == "exception_approved":
                merge_blocked = False
                exception_detail = {
                    "status": "approved",
                    "reason": "Emergency production hotfix for Stripe webhook signature verification mismatch",
                    "policy_scope": "high_and_critical_severity",
                    "requested_by": "alice",
                    "requested_at": (now - timedelta(hours=2)).isoformat(),
                    "approved_by": "bob",
                    "approved_at": (now - timedelta(hours=1, minutes=50)).isoformat(),
                    "expires_at": (now + timedelta(hours=22)).isoformat(),
                    "duration_hours": 24,
                    "notes": "Security reviewer approved under emergency change protocol SEC-409."
                }

            cost = Decimal(0) if not p_tok else Decimal(str(round(p_tok / 1e6 * 0.15 + c_tok / 1e6 * 0.6, 5)))

            review = models.Review(
                pull_request_id=pr.id,
                commit_sha=pr.head_sha,
                status=status,
                summary_markdown=None if status != "completed" else (
                    f"Reviewed '{title}'. " + ("No security or quality issues detected. All merge checks passed." if not picked else f"Found {len(picked)} issue(s) requiring attention before merge.")
                ),
                code_quality_score=quality,
                total_findings=len(picked),
                prompt_tokens=p_tok,
                completion_tokens=c_tok,
                estimated_cost_usd=cost,
                latency_ms=latency,
                defense_triggered=(mode == "blocked_injection"),
                merge_blocked=merge_blocked,
                policy_violations={"violations": violations} if violations else None,
                exception_detail=exception_detail,
                error_message=err_msg,
                model_used=model_routed if status == "completed" else None,
                routing_reason=routing_reason if status == "completed" else None,
                fix_pr_url=f"https://github.com/{repo_name}/pull/{num+500}" if (picked and any(p[5] for p in picked)) else None,
                created_at=now - timedelta(days=len(PRS_CONFIG) - i, hours=random.randint(1, 12)),
            )
            s.add(review)
            await s.flush()

            for path, t, d, sev, cat, fix, cwe in picked:
                c = classify(t, d, cwe)
                snip = f'# {path}\ncursor.execute(f"SELECT * FROM items WHERE query = \'{t}\'")' if "SQL" in t else f'def handle_request():\n    return {t.lower().replace(" ", "_")}()'
                evid = f"Taint trace identified untrusted input sink. Mapped to {c.cwe or 'CWE weakness'} and {c.owasp or 'OWASP Category'}."
                verif_stat = "draft_pr_opened" if fix else "unverified"

                s.add(models.Finding(
                    review_id=review.id,
                    file_path=path,
                    line_start=random.randint(12, 140),
                    line_end=random.randint(141, 160),
                    title=t,
                    description=d,
                    severity=sev,
                    category=cat,
                    code_snippet=snip,
                    evidence=evid,
                    confidence=Decimal(str(random.choice([0.91, 0.94, 0.96, 0.99]))),
                    suggested_fix=fix,
                    fix_verification_status=verif_stat,
                    cwe=c.cwe,
                    owasp=c.owasp,
                    posted_to_github=True
                ))

            # Audit ledger entries
            await audit.record(
                s,
                actor="pr-sentinel",
                action="review_completed" if status == "completed" else f"review_{status}",
                installation_id=500,
                target=f"{repo_name}#{num}",
                detail={
                    "status": status,
                    "findings": len(picked),
                    "model": model_routed,
                    "merge_blocked": merge_blocked,
                    "policy_violations": violations,
                    "exception_active": bool(exception_detail),
                }
            )

        await s.commit()
    print(f"Seeded {len(PRS_CONFIG)} reviews with error states, emergency exception, and repo settings across {len(REPOS)} repos.")


if __name__ == "__main__":
    asyncio.run(main("--reset" in sys.argv))
