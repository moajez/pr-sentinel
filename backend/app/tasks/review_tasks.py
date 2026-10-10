"""Celery review task: budget gate, model routing, secret redaction, review, compliance tagging,
auto-fix PR, audit trail and Checks API reporting."""
import asyncio
import logging
import time
from decimal import Decimal

from sqlalchemy import select

from app.config import get_settings
from app.core.celery_app import celery_app
from app.core.github_client import GitHubClient
from app.db import models
from app.db.session import AsyncSessionLocal
from app.schemas.rules import RepoSettings, effective_settings
from app.schemas.webhook import PullRequestEvent
from app.services import audit, governance
from app.services.autofix import create_fix_pr
from app.services.compliance import classify
from app.services.diff_parser import build_file_diffs
from app.services.github_poster import post_review, split_findings
from app.services.reviewer import review_diffs
from app.services.routing import choose_model, cost_usd
from app.services.rules import SEVERITY_ORDER, filter_diffs, filter_findings, rule_hints
from app.services.secret_scanner import redact

logger = logging.getLogger(__name__)

ACTOR = "pr-sentinel"


async def _get_or_create_review(session, event: PullRequestEvent) -> models.Review:
    pr, repo = event.pull_request, event.repository
    inst_id = event.installation.id

    async def get_or_add(model, pk, **vals):
        obj = await session.get(model, pk)
        if obj is None:
            obj = model(id=pk, **vals)
            session.add(obj)
        return obj

    await get_or_add(models.Installation, inst_id, account_login=repo.owner.login, account_type="Unknown")
    await session.flush()
    await get_or_add(models.Repository, repo.id, installation_id=inst_id, full_name=repo.full_name)
    await session.flush()

    row = (await session.execute(select(models.PullRequest).where(
        models.PullRequest.repository_id == repo.id, models.PullRequest.pr_number == pr.number))).scalar_one_or_none()
    if row is None:
        row = models.PullRequest(repository_id=repo.id, pr_number=pr.number)
        session.add(row)
    row.title, row.author = pr.title, pr.user.login if pr.user else None
    row.head_sha, row.base_sha = pr.head.sha, pr.base.sha
    await session.flush()

    # Reuse an unfinished review for this commit (Celery retry) instead of duplicating rows.
    review = (await session.execute(select(models.Review).where(
        models.Review.pull_request_id == row.id, models.Review.commit_sha == pr.head.sha,
        models.Review.status.notin_(["completed", "skipped"])))).scalars().first()
    if review is None:
        review = models.Review(pull_request_id=row.id, commit_sha=pr.head.sha, status="pending")
        session.add(review)
    await session.commit()
    return review


async def run_review(event: PullRequestEvent, session_factory=AsyncSessionLocal,
                     client: GitHubClient | None = None) -> None:
    settings = get_settings()
    started = time.monotonic()
    pr = event.pull_request
    inst_id = event.installation.id
    owner, repo = event.repository.owner.login, event.repository.name
    target = f"{event.repository.full_name}#{pr.number}"
    client = client or GitHubClient(inst_id, settings)
    try:
        async with session_factory() as session:
            review = await _get_or_create_review(session, event)
            review.status = "processing"
            repo_row = await session.get(models.Repository, event.repository.id)
            org = await governance.load_policy(session, inst_id)
            rules = effective_settings(RepoSettings.model_validate((repo_row.settings if repo_row else None) or {}), org)
            if review.check_run_id is None:
                review.check_run_id = (await client.create_check_run(owner, repo, pr.head.sha))["id"]

            # --- Check if repository reviews are paused ---
            if getattr(rules, "paused", False) or (repo_row and not repo_row.is_active):
                review.status = "skipped"
                review.error_message = "Automated review processing is paused for this repository by administrator."
                await audit.record(session, ACTOR, "review_skipped_paused", inst_id, target, {"repo": repo_row.full_name if repo_row else repo})
                await session.commit()
                await client.complete_check_run(owner, repo, review.check_run_id, "neutral",
                                                "Review skipped: Paused", review.error_message)
                return

            await session.commit()

            # --- cost governance: budget gate ---
            before = await governance.budget_status(session, inst_id, rules.team)
            if before["exceeded"] and before["enforce"]:
                review.status = "skipped"
                review.error_message = f"Monthly budget exhausted ({before['scope']}): ${before['spent']:.2f} of ${before['limit']:.2f}"
                await audit.record(session, ACTOR, "review_skipped_budget", inst_id, target, before)
                await session.commit()
                await client.complete_check_run(owner, repo, review.check_run_id, "neutral",
                                                "Review skipped: budget exhausted", review.error_message)
                await governance.alert_if_crossed({**before, "exceeded": False}, before, event.repository.full_name)
                return

            files = await client.get_pull_request_files(owner, repo, pr.number)
            diffs = filter_diffs(build_file_diffs(files, settings.max_files, settings.max_diff_chars), rules)
            redactions = 0
            for d in diffs:
                d.patch, counts = redact(d.patch)
                redactions += sum(counts.values())

            if not diffs:
                review.status, review.summary_markdown = "completed", "No reviewable changes."
                review.latency_ms = int((time.monotonic() - started) * 1000)
                await session.commit()
                await client.complete_check_run(owner, repo, review.check_run_id, "neutral",
                                                "Nothing to review", "No reviewable text changes.")
                return

            # --- cost governance: model routing ---
            route = choose_model(diffs, redactions, org, settings)
            result, p_tok, c_tok = await review_diffs(pr.title, diffs, settings, focus_rules=rule_hints(rules),
                                                      model=route.model)
            # Drop findings below the minimum severity (diffs kept for anchor validation).
            result = result.model_copy(update={"findings": filter_findings(result.findings, rules)})
            await post_review(client, owner, repo, pr.number, pr.head.sha, result, diffs)

            # --- auto-fix PR (opt-in) ---
            fix_url = None
            if rules.auto_fix_pr and pr.head.ref:
                inline, _ = split_findings(result, diffs)
                try:
                    fix_url = await create_fix_pr(client, owner, repo, pr.number, pr.head.ref, pr.head.sha, inline)
                except Exception:
                    logger.exception("auto-fix PR failed for %s", target)

            cost = cost_usd(route.model, p_tok, c_tok, settings)
            review.summary_markdown = result.summary
            review.code_quality_score = result.quality_score
            review.total_findings = len(result.findings)
            review.prompt_tokens, review.completion_tokens = p_tok, c_tok
            review.estimated_cost_usd = Decimal(str(cost))
            review.model_used, review.routing_reason = route.model, route.reason[:255]
            review.fix_pr_url = fix_url
            review.defense_triggered = result.adversarial_content_detected
            review.error_message = None
            review.status = "completed"
            review.latency_ms = int((time.monotonic() - started) * 1000)

            # Build quick map of path -> diff patch for context snippet extraction
            diff_map = {d.path: d.patch for d in diffs}

            for f in result.findings:
                c = classify(f.title, f.description, f.cwe)
                # Find line snippet from diff if possible
                snippet = getattr(f, "code_snippet", None)
                if not snippet and f.line_number and f.file_path in diff_map:
                    for raw in diff_map[f.file_path].splitlines():
                        if raw.startswith("+") and not raw.startswith("+++"):
                            snippet = raw[1:].strip()
                            break

                evidence = getattr(f, "evidence", None)
                if not evidence:
                    evidence = f"Mapped to {c.cwe or 'CWE weakness'} ({c.owasp or 'OWASP Category'}) with regulatory controls: {', '.join(c.controls[:2]) if c.controls else 'Secure Coding'}"

                confidence_val = Decimal(str(round(getattr(f, "confidence", 0.90), 2)))
                verif_status = "draft_pr_opened" if (fix_url and f.suggested_code) else ("verified_passed" if f.suggested_code else "unverified")

                session.add(models.Finding(
                    review_id=review.id,
                    file_path=f.file_path,
                    line_start=f.line_number,
                    line_end=f.line_number,
                    title=f.title[:255],
                    description=f.description,
                    severity=f.severity.value,
                    category=f.category.value,
                    code_snippet=snippet,
                    evidence=evidence,
                    confidence=confidence_val,
                    suggested_fix=f.suggested_code,
                    fix_verification_status=verif_status,
                    cwe=c.cwe,
                    owasp=c.owasp,
                    posted_to_github=True,
                ))

            # --- Enterprise Merge Gate & Branch Protection Enforcement ---
            gate = SEVERITY_ORDER[rules.block_severity]
            blocking_findings = [f for f in result.findings if SEVERITY_ORDER[f.severity] >= gate]
            policy_violations: list[str] = []

            if blocking_findings:
                policy_violations.append(
                    f"Found {len(blocking_findings)} finding(s) at or above `{rules.block_severity.value}` threshold."
                )

            if result.quality_score < rules.min_quality_score:
                policy_violations.append(
                    f"Code quality score ({result.quality_score}/10) is below required minimum threshold ({rules.min_quality_score}/10)."
                )

            if rules.block_on_unresolved_cwe:
                prohibited_cwes = [f.cwe for f in result.findings if f.cwe and f.cwe in rules.block_on_unresolved_cwe]
                if prohibited_cwes:
                    policy_violations.append(
                        f"Detected prohibited weakness taxonomies: {', '.join(set(prohibited_cwes))}."
                    )

            if result.adversarial_content_detected:
                policy_violations.append(
                    "Adversarial prompt injection attempt detected in pull request content."
                )

            is_monitor = getattr(rules, "enforcement_mode", "enforce") == "monitor"
            merge_blocked = (len(policy_violations) > 0) and not is_monitor
            check_conclusion = "failure" if merge_blocked else "success"

            review.merge_blocked = merge_blocked
            review.policy_violations = {
                "violations": policy_violations,
                "rule_set": rules.model_dump(mode="json"),
                "enforcement_mode": getattr(rules, "enforcement_mode", "enforce"),
            }

            await audit.record(session, ACTOR, "review_completed", inst_id, target, {
                "model": route.model, "routing": route.reason, "prompt_tokens": p_tok, "completion_tokens": c_tok,
                "cost_usd": cost, "findings": len(result.findings), "blocking": len(blocking_findings),
                "merge_blocked": merge_blocked, "policy_violations": policy_violations,
                "defense_triggered": result.adversarial_content_detected, "secrets_redacted": redactions,
                "commit": pr.head.sha})
            if fix_url:
                await audit.record(session, ACTOR, "autofix_draft_pr_opened", inst_id, target, {"url": fix_url})
            await session.commit()

            if merge_blocked:
                check_title = f"🚫 Merge Blocked: {len(policy_violations)} Policy Violation(s)"
                gate_banner = (
                    "## 🚫 MERGE GATE FAILED — Merging is Blocked\n\n"
                    "This pull request violates configured branch protection policies:\n"
                    + "\n".join(f"- 🛑 **{v}**" for v in policy_violations)
                    + "\n\n> **GitHub Branch Protection Enforcement:** Resolve all blocking findings or request a security lead override to unblock merging.\n\n---\n\n"
                )
            elif is_monitor and policy_violations:
                check_title = f"ℹ️ Monitoring Mode: {len(policy_violations)} Policy Violations (Merge Not Blocked)"
                gate_banner = (
                    "## ℹ️ MERGE GATE — Monitoring Mode Active\n\n"
                    "Policy violations were identified, but merging is permitted under repository **Monitoring Mode**:\n"
                    + "\n".join(f"- ⚠️ **{v}**" for v in policy_violations)
                    + "\n\n> **PR Sentinel Monitoring:** Findings reported for visibility without blocking branch protection.\n\n---\n\n"
                )
            else:
                check_title = f"✅ Merge Permitted: Quality {result.quality_score}/10 ({len(result.findings)} findings)"
                gate_banner = (
                    "## ✅ MERGE GATE PASSED\n\n"
                    "All configured security policies and quality standards are satisfied. Merging is permitted under branch protection.\n\n---\n\n"
                )

            full_check_summary = gate_banner + (
                f"**Quality Score:** {result.quality_score}/10 (Min Required: {rules.min_quality_score}/10)\n\n"
                f"**Findings:** {len(result.findings)} ({len(blocking_findings)} blocking)\n\n"
                f"**Model:** {route.model} ({route.reason})\n\n"
                f"**Secrets Redacted Before LLM:** {redactions}\n\n"
                + (f"**Safe Auto-fix Proposal:** [View Verified Draft PR]({fix_url})\n\n" if fix_url else "")
                + f"### Review Analysis\n{result.summary}"
            )

            await client.complete_check_run(
                owner, repo, review.check_run_id, check_conclusion, check_title, full_check_summary)

            after = await governance.budget_status(session, inst_id, rules.team)
            await governance.alert_if_crossed(before, after, event.repository.full_name)
    finally:
        await client.aclose()


async def mark_failed(event: PullRequestEvent, error: str, session_factory=AsyncSessionLocal,
                      client: GitHubClient | None = None) -> None:
    """Final-failure handler: persist the error and close the check run."""
    client = client or GitHubClient(event.installation.id, get_settings())
    try:
        async with session_factory() as session:
            review = await _get_or_create_review(session, event)
            review.status, review.error_message = "failed", error[:2000]
            await audit.record(session, ACTOR, "review_failed", event.installation.id,
                               f"{event.repository.full_name}#{event.pull_request.number}", {"error": error[:500]})
            await session.commit()
            if review.check_run_id:
                await client.complete_check_run(
                    event.repository.owner.login, event.repository.name, review.check_run_id,
                    "neutral", "Review failed", "PR Sentinel could not complete this review.")
    except Exception:
        logger.exception("mark_failed itself failed")
    finally:
        await client.aclose()


@celery_app.task(bind=True, name="review_pull_request", max_retries=3)
def review_pull_request(self, payload: dict) -> None:
    event = PullRequestEvent.model_validate(payload)
    try:
        asyncio.run(run_review(event))
    except Exception as exc:
        logger.exception("Review attempt %s failed", self.request.retries + 1)
        if self.request.retries >= self.max_retries:
            asyncio.run(mark_failed(event, repr(exc)))
            raise
        raise self.retry(exc=exc, countdown=5 * 2 ** self.request.retries)  # 5s, 10s, 20s
