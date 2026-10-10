"""Apply per-repo RepoSettings to diffs and findings."""
from fnmatch import fnmatch

from app.schemas.review import CodeFinding, FindingSeverity
from app.schemas.rules import RepoSettings
from app.services.diff_parser import FileDiff

SEVERITY_ORDER = {s: i for i, s in enumerate(
    [FindingSeverity.INFO, FindingSeverity.LOW, FindingSeverity.MEDIUM, FindingSeverity.HIGH, FindingSeverity.CRITICAL])}


def is_excluded(path: str, patterns: list[str]) -> bool:
    # fnmatch's `*` crosses `/`, so `dist/**` and `*.min.js` both behave like gitignore-ish globs.
    return any(fnmatch(path, p) or fnmatch(path.rsplit("/", 1)[-1], p) for p in patterns)


def filter_diffs(diffs: list[FileDiff], settings: RepoSettings) -> list[FileDiff]:
    return [d for d in diffs if not is_excluded(d.path, settings.exclude_paths)]


def filter_findings(findings: list[CodeFinding], settings: RepoSettings) -> list[CodeFinding]:
    floor = SEVERITY_ORDER[settings.min_severity]
    return [f for f in findings if SEVERITY_ORDER[f.severity] >= floor]


def rule_hints(settings: RepoSettings) -> list[str]:
    return [f"{r.name} (severity: {r.severity.value})" for r in settings.rules if r.enabled]

