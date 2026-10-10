import httpx

from app.core.github_client import GitHubClient
from app.schemas.review import PRReviewResult
from app.services.diff_parser import FileDiff

SEVERITY_EMOJI = {"critical": "🛑", "high": "🔴", "medium": "🟠", "low": "🟡", "info": "ℹ️"}


def format_summary(result: PRReviewResult, unanchored: list | None = None) -> str:
    lines = [
        "## 🛡️ PR Sentinel Code Review & Security Gate",
        f"**Quality score:** {result.quality_score}/10 · **Total findings:** {len(result.findings)}",
        "",
        result.summary,
    ]
    if result.key_positives:
        lines += ["", "### Key Positives", *[f"- {p}" for p in result.key_positives]]
    if result.adversarial_content_detected:
        lines += [
            "",
            "> [!WARNING]",
            "> ⚠️ **Adversarial Content Flagged:** Possible prompt-injection or instruction-override attempts were detected and neutralized in this change.",
        ]
    if unanchored:
        lines += ["", "### Unanchored Findings (Broader Scope)"]
        lines += [f"- {format_finding_title(f)} — `{f.file_path}`: {f.description}" for f in unanchored]
    return "\n".join(lines)


def format_finding_title(f) -> str:
    sev = f.severity.value if hasattr(f.severity, "value") else str(f.severity)
    return f"{SEVERITY_EMOJI.get(sev, '⚠️')} **[{sev.upper()}] {f.title}**"


def format_comment_body(f) -> str:
    """Evidence-backed inline finding format for GitHub review comments."""
    cat = f.category.value if hasattr(f.category, "value") else str(f.category)
    lines = [
        f"{format_finding_title(f)} _({cat})_",
        "",
        f"**Explanation:** {f.description}",
    ]

    evidence = getattr(f, "evidence", None)
    if evidence:
        lines.append(f"\n**Supporting Evidence / Taint Flow:** {evidence}")
    elif getattr(f, "cwe", None):
        lines.append(f"\n**Taxonomy Reference:** {f.cwe}")

    confidence = getattr(f, "confidence", 0.90)
    if confidence is not None:
        lines.append(f"**Confidence Score:** {int(float(confidence) * 100)}%")

    code_snippet = getattr(f, "code_snippet", None)
    if code_snippet:
        lines.append(f"\n**Affected Code:**\n```\n{code_snippet}\n```")

    if getattr(f, "suggested_code", None):
        # ```suggestion renders GitHub's one-click "Commit suggestion" button
        lines.append(f"\n```suggestion\n{f.suggested_code}\n```")

    return "\n".join(lines)


def split_findings(result: PRReviewResult, diffs: list[FileDiff]):
    """Separate findings that map to a commentable diff line from those that don't."""
    valid = {d.path: d.added_lines for d in diffs}
    inline, other = [], []
    for f in result.findings:
        if f.line_number and f.line_number in valid.get(f.file_path, set()):
            inline.append(f)
        else:
            other.append(f)
    return inline, other


async def post_review(
    client: GitHubClient,
    owner: str,
    repo: str,
    number: int,
    commit_sha: str,
    result: PRReviewResult,
    diffs: list[FileDiff],
) -> None:
    inline, other = split_findings(result, diffs)
    comments = [
        {"path": f.file_path, "line": f.line_number, "side": "RIGHT", "body": format_comment_body(f)}
        for f in inline
    ]
    body = format_summary(result, other)
    try:
        await client.create_review(owner, repo, number, commit_sha, body, comments)
    except httpx.HTTPStatusError as e:
        if e.response.status_code != 422 or not comments:
            raise
        # Bad anchors fallback: post summary comment containing everything.
        await client.create_issue_comment(owner, repo, number, format_summary(result, result.findings))
