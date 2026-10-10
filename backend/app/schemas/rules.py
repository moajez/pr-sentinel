from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.review import FindingSeverity


class RuleConfig(BaseModel):
    name: str
    enabled: bool = True
    severity: FindingSeverity = FindingSeverity.MEDIUM


class RepoSettings(BaseModel):
    """Per-repo review configuration (mirrors the `.sentinel.yml` review block)."""
    min_severity: FindingSeverity = FindingSeverity.INFO
    exclude_paths: List[str] = Field(default_factory=list)
    rules: List[RuleConfig] = Field(default_factory=list)
    # Merge gate: the PR Sentinel check fails when any finding is at/above this severity.
    block_severity: FindingSeverity = FindingSeverity.HIGH
    min_quality_score: int = Field(7, ge=1, le=10, description="Minimum code quality score required to pass check")
    block_on_unresolved_cwe: List[str] = Field(default_factory=list, description="List of CWEs that immediately block merge")
    team: Optional[str] = None            # cost-governance grouping
    auto_fix_pr: bool = True              # open a fix PR with validated patches
    enforcement_mode: str = Field("enforce", description="Monitor only ('monitor') or Enforce policies ('enforce')")
    auto_fix_behavior: str = Field("draft_pr", description="disabled | draft_pr | suggestions_only")
    require_check: bool = Field(True, description="Require the PR Sentinel GitHub Check before merging")
    fail_open: bool = Field(False, description="Allow merging when PR Sentinel is unavailable (fail open vs fail closed)")
    paused: bool = Field(False, description="Temporarily stop automated review processing for this repo")



class OrgPolicy(BaseModel):
    """Org-wide controls applied to every repo of an installation (repo settings can only tighten)."""
    min_severity: Optional[FindingSeverity] = None
    block_severity: Optional[FindingSeverity] = None
    min_quality_score: Optional[int] = None
    blocked_cwes: List[str] = Field(default_factory=list)
    exclude_paths: List[str] = Field(default_factory=list)
    monthly_budget_usd: Optional[float] = None
    team_budgets: Dict[str, float] = Field(default_factory=dict)
    enforce_budget: bool = True           # skip reviews once the budget is exhausted
    alert_threshold_pct: int = 80
    routing_enabled: bool = True
    cheap_model: Optional[str] = None
    strong_model: Optional[str] = None
    allow_auto_fix: bool = True


_ORDER = ["info", "low", "medium", "high", "critical"]


def effective_settings(repo: RepoSettings, org: OrgPolicy) -> RepoSettings:
    """Merge org policy into repo settings: stricter severity wins, exclusions are unioned."""
    def lowest(a, b):  # the more sensitive (lower) threshold wins
        vals = [v for v in (a, b) if v is not None]
        return min(vals, key=lambda v: _ORDER.index(v.value))

    # Higher quality threshold is stricter
    effective_min_score = max(repo.min_quality_score, org.min_quality_score or repo.min_quality_score)
    combined_cwes = sorted(set(repo.block_on_unresolved_cwe) | set(org.blocked_cwes))

    return repo.model_copy(update={
        "min_severity": lowest(repo.min_severity, org.min_severity),
        "block_severity": lowest(repo.block_severity, org.block_severity),
        "min_quality_score": effective_min_score,
        "block_on_unresolved_cwe": combined_cwes,
        "exclude_paths": sorted(set(repo.exclude_paths) | set(org.exclude_paths)),
        "auto_fix_pr": repo.auto_fix_pr and org.allow_auto_fix,
    })
