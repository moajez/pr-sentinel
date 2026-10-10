export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  id: string;
  file_path: string;
  line_start: number | null;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  code_snippet?: string | null;
  evidence?: string | null;
  confidence?: number | null;
  suggested_fix: string | null;
  fix_verification_status?: string | null;
  cwe?: string | null;
  owasp?: string | null;
  suppression?: {
    suppressed: boolean;
    suppressed_by?: string;
    suppressed_at?: string;
    reason?: string;
    notes?: string;
  } | null;
}

export interface ExceptionDetail {
  status: "requested" | "approved" | "rejected" | "expired";
  reason: string;
  policy_scope?: string;
  requested_by?: string;
  requested_at?: string;
  approved_by?: string;
  approved_at?: string;
  expires_at?: string;
  duration_hours?: number;
  notes?: string;
  rejection_notes?: string;
}

export interface Review {
  id: string;
  repo: string;
  pr_number: number;
  pr_title: string | null;
  author: string | null;
  commit_sha: string;
  status: "pending" | "processing" | "completed" | "failed" | "skipped";
  code_quality_score: number | null;
  total_findings: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  defense_triggered: boolean;
  merge_blocked?: boolean;
  policy_violations?: { violations: string[] } | null;
  exception_detail?: ExceptionDetail | null;
  error_message?: string | null;
  finding_counts?: Record<string, number>;
  created_at: string;
  model_used?: string | null;
  routing_reason?: string | null;
  fix_pr_url?: string | null;
}

export interface ReviewDetail extends Review {
  summary_markdown: string | null;
  error_message: string | null;
  findings: Finding[];
}

export interface Overview {
  total_reviews: number;
  completed_reviews: number;
  failed_reviews: number;
  total_findings: number;
  avg_latency_ms: number;
  avg_quality_score: number | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost_usd: number;
  defense_triggered: number;
  severity_distribution: Record<string, number>;
  daily: { date: string; reviews: number; cost_usd: number; tokens: number }[];
}

export interface RuleConfig {
  name: string;
  enabled: boolean;
  severity: Severity;
}

export interface RepoSettings {
  min_severity: Severity;
  exclude_paths: string[];
  rules: RuleConfig[];
  block_severity?: Severity;
  team?: string | null;
  auto_fix_pr?: boolean;
  min_quality_score?: number;
  enforcement_mode?: "enforce" | "monitor";
  auto_fix_behavior?: "disabled" | "draft_pr" | "suggestions_only";
  require_check?: boolean;
  fail_open?: boolean;
  paused?: boolean;
}

export interface Repo {
  id: number;
  full_name: string;
  is_active: boolean;
  branch_protection_enforced?: boolean;
  settings: RepoSettings;
}

export interface EvalRun {
  id: string;
  model_name: string;
  defense_mode: "baseline" | "sanitized_delimiter" | "full_hardened";
  total_samples: number;
  benign_samples: number;
  attacks_thwarted: number;
  false_positives: number;
  attack_success_rate: number;
  false_positive_rate: number;
  detection_accuracy: number | null;
  avg_latency_ms: number;
  total_tokens: number;
  duration_ms: number;
  is_mock: boolean;
  created_at: string;
}

export interface EvalQualityRun {
  id: string;
  model_name: string;
  dataset_size: number;
  flawed_cases: number;
  benign_cases: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  false_positive_rate: number;
  avg_latency_ms: number;
  total_tokens: number;
  cost_usd: number;
  prompt_fingerprint: string;
  is_mock: boolean;
  created_at: string;
}

export interface ControlRuleStatus {
  id: string;
  name: string;
  framework_ref: string;
  category: string;
  status: "passed" | "failed" | "not_evaluated" | "error";
  reason: string;
  violations_count: number;
}

export interface ComplianceReport {
  total_security_findings: number;
  by_owasp: Record<string, number>;
  by_cwe: Record<string, number>;
  frameworks: {
    framework: string;
    controls_covered: string[];
    findings_count: number;
  }[];
  control_rules?: ControlRuleStatus[];
  recent_findings: {
    id: string;
    file_path: string;
    title: string;
    severity: string;
    category: string;
    cwe: string | null;
    owasp: string | null;
    repo: string;
    pr_number: number;
    code_snippet?: string | null;
    confidence?: number | null;
    description?: string | null;
  }[];
}

export interface GovernanceOverview {
  budget: {
    limit: number | null;
    spent: number;
    scope: string | null;
    pct: number;
    exceeded: boolean;
    alert: boolean;
    enforce: boolean;
  } | null;
  month_spent_usd: number;
  month_forecast_usd: number;
  by_model: {
    model: string;
    reviews: number;
    cost_usd: number;
    avg_latency_ms: number;
  }[];
  by_team: {
    team: string;
    cost_usd: number;
    reviews: number;
  }[];
}

export interface AuditItem {
  id: number;
  created_at: string;
  installation_id: number | null;
  actor: string;
  action: string;
  target: string | null;
  detail: any;
  prev_hash: string;
  hash: string;
}

export interface Member {
  id: number;
  user_id: number;
  github_login: string;
  installation_id: number;
  role: string;
}

export interface VerifyChainResult {
  ok: boolean;
  checked: number;
  broken_at: number | null;
  first_id?: number | null;
  last_id?: number | null;
  verified_at?: string | null;
  duration_ms?: number;
  head_hash?: string | null;
  verification_errors?: number;
}

export interface CheckpointResult {
  ok: boolean;
  status: "demo_created" | "externally_anchored" | "failed" | "not_configured";
  checkpoint_id: string;
  provider: string;
  head_hash: string;
  covered_range: string;
  created_at: string;
  verified: boolean;
  is_demo: boolean;
  message: string;
}
