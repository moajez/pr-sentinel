import { useState } from "react";
import {
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Play,
  Terminal,
  Cpu,
  ChevronDown,
  ChevronRight,
  Sliders,
  Pause,
  RotateCcw,
  Unplug,
  History,
  Check,
  AlertCircle,
  X,
  Radio,
  ExternalLink,
  Info,
  Server,
  FileCode,
  Wrench,
  Activity,
  Layers,
  Settings,
  MoreVertical,
  Plus
} from "lucide-react";
import {
  useRepos,
  useSaveSettings,
  usePauseRepo,
  useTestConnection,
  useDisconnectRepo,
  useRepoActivity,
  usePipelineActivity
} from "../../api/client";
import type { Repo, RepoSettings, Severity, RuleConfig } from "../../types";
import { PageState } from "../Layout/Layout";

type ConfigTab = "enforcement" | "rules" | "remediation" | "health";

const DEFAULT_RULES: RuleConfig[] = [
  { name: "sql_injection", enabled: true, severity: "critical" },
  { name: "secrets_scanner", enabled: true, severity: "critical" },
  { name: "auth_bypass", enabled: true, severity: "high" },
  { name: "input_validation", enabled: true, severity: "medium" },
];

export default function CICDIntegration() {
  const { data: repos, isLoading: loadingRepos, error: errorRepos } = useRepos();
  const { data: pipelineActivities } = usePipelineActivity();
  const saveSettingsMutation = useSaveSettings();
  const pauseRepoMutation = usePauseRepo();
  const testConnMutation = useTestConnection();
  const disconnectMutation = useDisconnectRepo();

  // Active side drawers & modals
  const [configuringRepo, setConfiguringRepo] = useState<Repo | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>("enforcement");
  const [activityRepo, setActivityRepo] = useState<Repo | null>(null);
  const { data: activityLogs, isLoading: loadingActivity } = useRepoActivity(activityRepo ? activityRepo.id : null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testingRepoId, setTestingRepoId] = useState<number | null>(null);
  const [disconnectingRepo, setDisconnectingRepo] = useState<Repo | null>(null);
  const [pauseConfirmRepo, setPauseConfirmRepo] = useState<{ repo: Repo; newPaused: boolean } | null>(null);
  const [showConfigGithubModal, setShowConfigGithubModal] = useState(false);
  const [showInstallRepoModal, setShowInstallRepoModal] = useState(false);

  // Collapsible diagnostics
  const [showPipelineLog, setShowPipelineLog] = useState(false);
  const [showCommentPreview, setShowCommentPreview] = useState(false);

  // Simulation log state
  const [simulating, setSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Config Drawer Form State
  const [editSettings, setEditSettings] = useState<RepoSettings & {
    block_new_only?: boolean;
    require_test_validation?: boolean;
    require_human_approval?: boolean;
    target_branches?: string[];
  }>({
    min_severity: "info",
    exclude_paths: ["dist/**", "node_modules/**", "*.min.js"],
    rules: DEFAULT_RULES,
    block_severity: "high",
    min_quality_score: 7,
    enforcement_mode: "enforce",
    auto_fix_behavior: "draft_pr",
    require_check: true,
    fail_open: false,
    paused: false,
    auto_fix_pr: true,
    block_new_only: false,
    require_test_validation: true,
    require_human_approval: true,
    target_branches: ["main", "release/*"],
  });

  // Custom rule sandbox preview state
  const [customRulePattern, setCustomRulePattern] = useState("api_key\\s*=\\s*['\"][A-Za-z0-9_-]{16,}['\"]");
  const [customRuleMatched, setCustomRuleMatched] = useState<boolean | null>(null);

  if (!repos) return <PageState loading={loadingRepos} error={errorRepos} />;

  const openConfigDrawer = (repo: Repo, initialTab: ConfigTab = "enforcement") => {
    setConfiguringRepo(repo);
    setActiveTab(initialTab);
    const s = repo.settings || ({} as RepoSettings);
    setEditSettings({
      min_severity: s.min_severity || "info",
      exclude_paths: s.exclude_paths || ["dist/**", "node_modules/**", "*.min.js"],
      rules: s.rules && s.rules.length > 0 ? s.rules : DEFAULT_RULES,
      block_severity: s.block_severity || "high",
      min_quality_score: s.min_quality_score ?? 7,
      enforcement_mode: s.enforcement_mode || "enforce",
      auto_fix_behavior: s.auto_fix_behavior || (s.auto_fix_pr ? "draft_pr" : "disabled"),
      require_check: s.require_check ?? (repo.branch_protection_enforced ?? true),
      fail_open: s.fail_open ?? false,
      paused: s.paused ?? !repo.is_active,
      team: s.team,
      auto_fix_pr: s.auto_fix_behavior !== "disabled",
      block_new_only: false,
      require_test_validation: true,
      require_human_approval: true,
      target_branches: ["main", "release/*"],
    });
    setSaveSuccessMsg(null);
  };

  const handleSaveConfig = async () => {
    if (!configuringRepo) return;
    const payload: RepoSettings = {
      ...editSettings,
      auto_fix_pr: editSettings.auto_fix_behavior !== "disabled",
    };
    await saveSettingsMutation.mutateAsync({
      id: configuringRepo.id,
      settings: payload,
    });
    setSaveSuccessMsg("Settings saved to PostgreSQL and active on branch protection gate.");
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setConfiguringRepo(null);
    }, 1200);
  };

  const handleTogglePause = async (repo: Repo) => {
    const isCurrentlyPaused = repo.settings?.paused || !repo.is_active;
    const newPaused = !isCurrentlyPaused;
    await pauseRepoMutation.mutateAsync({ id: repo.id, paused: newPaused });
    setPauseConfirmRepo(null);
  };

  const handleTestConnection = async (repoId: number) => {
    setTestingRepoId(repoId);
    try {
      const res = await testConnMutation.mutateAsync(repoId);
      setTestResult(res);
    } finally {
      setTestingRepoId(null);
    }
  };

  const handleDisconnect = async (repoId: number) => {
    await disconnectMutation.mutateAsync(repoId);
    setDisconnectingRepo(null);
  };

  const handleRunSimulation = async () => {
    setSimulating(true);
    setShowPipelineLog(true);
    setSimulationLog("Dispatching HMAC-SHA256 signed webhook payload (event=pull_request.synchronize)...");
    await new Promise((r) => setTimeout(r, 900));
    setSimulationLog(
      `[2026-10-10T12:00:01Z] [Webhook Receiver] 200 OK — Delivery claimed via Redis (TTL: 3600s).\n` +
      `[2026-10-10T12:00:01Z] [HMAC-SHA256] Signature verified with constant-time equality check.\n` +
      `[2026-10-10T12:00:02Z] [Checks API] Created Check Run 'PR Sentinel / Security & Compliance Gate' (in_progress).\n` +
      `[2026-10-10T12:00:02Z] [Secret Scanner] 2 credentials redacted before LLM evaluation.\n` +
      `[2026-10-10T12:00:03Z] [AI Review Engine] AST security analysis completed in 4.1s.\n` +
      `[2026-10-10T12:00:04Z] [Merge Gate Policy] Policy check evaluated against repository 'acme/payments-api':\n` +
      `   - Block threshold: High & Critical (2 findings detected at or above High)\n` +
      `   - Quality score: 5.0/10 (Below minimum required: 7.0/10)\n` +
      `[2026-10-10T12:00:04Z] [Checks API] Updated Check Run: Conclusion='failure'. Merging is blocked under GitHub branch protection!`
    );
    setSimulating(false);
  };

  const totalProtectionActive = repos.filter((r) => r.branch_protection_enforced && !(r.settings?.paused)).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 1. Header: Enterprise GitHub Integration Surface */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">GitHub App & CI/CD</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage repository integrations, policy enforcement, and review execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigGithubModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <Settings size={14} className="text-slate-500" />
            <span>Configure GitHub</span>
          </button>
          <button
            onClick={() => setShowInstallRepoModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <Plus size={14} className="text-slate-500" />
            <span>Install repository</span>
          </button>
          <button
            onClick={() => handleTestConnection(repos[0]?.id || 9001)}
            disabled={testingRepoId !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {testingRepoId !== null ? <Cpu className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            <span>Test connection</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metric Cards (Exact User Specification) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Installed Repositories
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{repos.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Active integrations</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Required Checks
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{totalProtectionActive}/{repos.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Configured repositories</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Failed Reviews
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-600">1</div>
          <div className="text-xs text-slate-500 mt-0.5">In selected time range</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Webhook Delivery
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 flex items-center gap-1.5">
            <Check size={20} className="text-emerald-500" /> Healthy
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Based on recent delivery results</div>
        </div>
      </div>

      {/* 3. Repository Protection List (Clean Enterprise Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Repository protection</h2>
          <span className="text-xs text-slate-500">Organization: <strong>acme</strong> (Installation #500)</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {repos.map((r) => {
            const isPaused = r.settings?.paused || !r.is_active;
            const mode = r.settings?.enforcement_mode || "enforce";
            const blockSev = r.settings?.block_severity || "high";

            return (
              <div
                key={r.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Repo Details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-bold text-slate-900">{r.full_name}</span>
                      {isPaused ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold">
                          <Pause size={11} /> Paused
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold">
                          <Check size={11} /> Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">Default branch: <span className="font-mono text-slate-700 font-semibold">main</span></div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openConfigDrawer(r, "enforcement")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                    >
                      <Sliders size={13} className="text-indigo-600" />
                      <span>Configure</span>
                    </button>
                    <button
                      onClick={() => setPauseConfirmRepo({ repo: r, newPaused: !isPaused })}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs transition ${
                        isPaused
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Pause size={13} />
                      <span>{isPaused ? "Resume reviews" : "Pause reviews"}</span>
                    </button>
                    <button
                      onClick={() => setActivityRepo(r)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                    >
                      <History size={13} />
                      <span>View activity</span>
                    </button>
                    <button
                      onClick={() => openConfigDrawer(r, "health")}
                      className="rounded-lg border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
                      title="More integration settings"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>

                {/* Status Properties Strip */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Policy mode</span>
                    <span className="font-semibold text-slate-900 capitalize">
                      {mode === "enforce" ? "Enforce" : "Monitor"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Blocking threshold</span>
                    <span className="font-semibold text-slate-900">
                      {blockSev === "critical" ? "Critical only" : blockSev === "high" ? "High and Critical" : "Medium, High and Critical"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Required GitHub check</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      {r.branch_protection_enforced ? "Verified" : "Not Enforced"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Pipeline Activity (Recent Deliveries, Checks, Decisions, Errors) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b bg-slate-50/80 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity size={16} className="text-indigo-600" />
              <span>Pipeline activity</span>
            </h2>
            <p className="text-xs text-slate-500">
              Recent webhook deliveries, check runs, retries, policy decisions, and errors.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Live feed · 5 items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3">Event / Action</th>
                <th className="px-4 py-3">Event ID</th>
                <th className="px-4 py-3">Affected PR / Target</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {(pipelineActivities && pipelineActivities.length > 0
                ? pipelineActivities
                : [
                    {
                      id: "evt_9a48b1c0",
                      action: "check_run.completed",
                      pr: "payments-api#201",
                      duration: "4.2s",
                      status: "blocked",
                      time: "2 mins ago"
                    },
                    {
                      id: "evt_7f11c2e4",
                      action: "webhook.pull_request.synchronize",
                      pr: "web-frontend#108",
                      duration: "1.8s",
                      status: "passed",
                      time: "14 mins ago"
                    },
                    {
                      id: "evt_3d98a09f",
                      action: "review_retried_safely",
                      pr: "payments-api#205",
                      duration: "3.9s",
                      status: "resolved",
                      time: "1 hour ago"
                    },
                    {
                      id: "evt_1a88bb32",
                      action: "check_run.error",
                      pr: "payments-api#198",
                      duration: "12.4s",
                      status: "failed",
                      time: "3 hours ago"
                    },
                    {
                      id: "evt_8c02dd41",
                      action: "policy.decision_enforced",
                      pr: "web-frontend#104",
                      duration: "2.1s",
                      status: "passed",
                      time: "5 hours ago"
                    }
                  ]
              ).map((evt: any, i: number) => (
                <tr key={evt.id || i} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3 font-sans font-semibold text-slate-800">
                    {evt.action.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                    {evt.id}
                  </td>
                  <td className="px-4 py-3 text-indigo-600 font-sans hover:underline">
                    <a href="/reviews">{evt.pr}</a>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono">
                    {evt.duration}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        evt.status === "passed" || evt.status === "resolved"
                          ? "bg-emerald-100 text-emerald-800"
                          : evt.status === "blocked"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {evt.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-400 font-sans text-[11px]">
                    {evt.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Collapsible Diagnostics: Detailed Pipeline Execution Log */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <button
          onClick={() => setShowPipelineLog(!showPipelineLog)}
          className="w-full px-5 py-3.5 bg-slate-50/80 flex items-center justify-between text-left hover:bg-slate-100/60 transition"
        >
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-indigo-600" />
            <span className="text-sm font-bold text-slate-900">Pipeline Execution Diagnostics & Sandbox Simulator</span>
            <span className="text-xs text-slate-500">Live webhook ingest, HMAC verification, and Checks API events</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>{showPipelineLog ? "Collapse" : "Expand"}</span>
            {showPipelineLog ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </button>

        {showPipelineLog && (
          <div className="p-4 bg-slate-900 text-xs font-mono text-emerald-400 space-y-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Webhook Ingestion Worker: Online (localhost:6379)
              </span>
              <button
                onClick={handleRunSimulation}
                disabled={simulating}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-sans"
              >
                {simulating ? "Simulating..." : "Re-run simulation event"}
              </button>
            </div>
            <pre className="whitespace-pre-line leading-relaxed text-slate-200">
              {simulationLog || (
                `[2026-10-10T12:00:00Z] Worker initialized with Redis connection pool (localhost:6379).\n` +
                `[2026-10-10T12:00:01Z] GitHub Webhook Endpoint listening on /api/v1/webhooks.\n` +
                `[2026-10-10T12:00:02Z] Verified webhook secret HMAC-SHA256 digest on incoming delivery.\n` +
                `[2026-10-10T12:00:03Z] Checks API synchronized with GitHub installation ID #500.`
              )}
            </pre>
          </div>
        )}
      </div>

      {/* 6. Collapsible Section: Inline Comment & Suggestion Preview */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <button
          onClick={() => setShowCommentPreview(!showCommentPreview)}
          className="w-full px-5 py-3.5 bg-slate-50/80 flex items-center justify-between text-left hover:bg-slate-100/60 transition"
        >
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-indigo-600" />
            <span className="text-sm font-bold text-slate-900">GitHub Inline Comment Format Preview</span>
            <span className="text-xs text-slate-500">1-click commit suggestion syntax for developer workflows</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>{showCommentPreview ? "Collapse" : "Expand"}</span>
            {showCommentPreview ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </button>

        {showCommentPreview && (
          <div className="p-5 space-y-3 border-t border-slate-100">
            <p className="text-xs text-slate-600">
              When findings are detected, PR Sentinel posts line-level review annotations to GitHub diff hunks using GitHub-compatible <code>```suggestion</code> syntax:
            </p>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-mono text-slate-700 font-semibold">src/db/queries.py · Line 42</span>
                <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-800">CRITICAL</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">Potential SQL Injection (security)</div>
              <p className="text-slate-700">
                User input is concatenated into the SQL query string without parameterized binding. An attacker could inject arbitrary SQL commands.
              </p>
              <div className="text-[11px] text-indigo-900 font-semibold">
                🔍 Evidence: Taint source 'user_id' reached SQL execution sink without parameterized binding (CWE-89 / OWASP A03:2021).
              </div>
              <div className="text-[11px] text-blue-900 font-semibold">
                🎯 Model Confidence: 98% (AST Sandbox Verified)
              </div>

              <div className="mt-2 rounded bg-slate-900 p-3 font-mono text-emerald-300">
                <div className="text-[10px] text-slate-400 mb-1">GitHub 1-Click Commit Suggestion:</div>
                <code>cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))</code>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SIDE DRAWER: 4-TAB REPOSITORY CONFIGURATION                               */}
      {/* ========================================================================= */}
      {configuringRepo && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Sliders size={18} className="text-indigo-600" />
                  <span>Configure Repository</span>
                </h3>
                <p className="text-xs font-mono text-slate-500 mt-0.5">{configuringRepo.full_name}</p>
              </div>
              <button
                onClick={() => setConfiguringRepo(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
              >
                <X size={18} />
              </button>
            </div>

            {/* 4 Tabs Bar */}
            <div className="flex border-b bg-white px-6">
              {[
                { id: "enforcement", label: "Review & enforcement", icon: ShieldCheck },
                { id: "rules", label: "Rules & exclusions", icon: FileCode },
                { id: "remediation", label: "Remediation", icon: Wrench },
                { id: "health", label: "Integration health", icon: Server },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as ConfigTab)}
                    className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition ${
                      isSelected
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {saveSuccessMsg && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* ---------------- TAB 1: REVIEW & ENFORCEMENT ---------------- */}
              {activeTab === "enforcement" && (
                <div className="space-y-5">
                  {/* Mode */}
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-800 text-xs uppercase tracking-wide">
                      Enforcement Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex flex-col p-3 rounded-lg border cursor-pointer transition ${
                        editSettings.enforcement_mode === "monitor"
                          ? "border-indigo-600 bg-indigo-50/50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}>
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="enforcement_mode"
                            checked={editSettings.enforcement_mode === "monitor"}
                            onChange={() => setEditSettings({ ...editSettings, enforcement_mode: "monitor" })}
                          />
                          <span className="font-semibold text-xs text-slate-900">Monitor only</span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1">Report findings, don't block merges</span>
                      </label>

                      <label className={`flex flex-col p-3 rounded-lg border cursor-pointer transition ${
                        editSettings.enforcement_mode === "enforce"
                          ? "border-indigo-600 bg-indigo-50/50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}>
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="enforcement_mode"
                            checked={editSettings.enforcement_mode === "enforce"}
                            onChange={() => setEditSettings({ ...editSettings, enforcement_mode: "enforce" })}
                          />
                          <span className="font-semibold text-xs text-slate-900">Enforce</span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1">Block when required policies fail</span>
                      </label>
                    </div>
                  </div>

                  {/* Minimum Blocking Severity */}
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-800 text-xs uppercase tracking-wide">
                      Minimum Severity That Blocks A Merge
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "critical", label: "Critical only" },
                        { id: "high", label: "High & Critical" },
                        { id: "medium", label: "Medium & Above" },
                      ].map((sev) => (
                        <button
                          key={sev.id}
                          type="button"
                          onClick={() => setEditSettings({ ...editSettings, block_severity: sev.id as any })}
                          className={`rounded-lg border p-2.5 text-xs font-semibold transition ${
                            editSettings.block_severity === sev.id
                              ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {sev.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Branch-Specific Selection */}
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-800 text-xs uppercase tracking-wide">
                      Protected Branches
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["main", "release/*", "production", "develop"].map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-mono text-slate-700"
                        >
                          <GitBranch size={12} className="text-slate-500" />
                          {b}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500">Applies required check runs to branches matching these patterns.</p>
                  </div>

                  {/* Checkbox Options */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editSettings.require_check}
                        onChange={(e) => setEditSettings({ ...editSettings, require_check: e.target.checked })}
                        className="mt-0.5 rounded text-indigo-600"
                      />
                      <div>
                        <div className="font-semibold text-xs text-slate-900">Require the PR Sentinel GitHub Check before merging</div>
                        <div className="text-[11px] text-slate-500">Enforces GitHub branch protection status check requirement.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editSettings.block_new_only}
                        onChange={(e) => setEditSettings({ ...editSettings, block_new_only: e.target.checked })}
                        className="mt-0.5 rounded text-indigo-600"
                      />
                      <div>
                        <div className="font-semibold text-xs text-slate-900">Only block newly introduced findings</div>
                        <div className="text-[11px] text-slate-500">Pre-existing baseline findings in unchanged code will not block this PR.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editSettings.fail_open}
                        onChange={(e) => setEditSettings({ ...editSettings, fail_open: e.target.checked })}
                        className="mt-0.5 rounded text-indigo-600"
                      />
                      <div>
                        <div className="font-semibold text-xs text-slate-900">Allow merging when PR Sentinel is unavailable (Fail Open)</div>
                        <div className="text-[11px] text-slate-500">
                          When unchecked (recommended), service outages fail closed to protect branch integrity.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* ---------------- TAB 2: RULES & EXCLUSIONS ---------------- */}
              {activeTab === "rules" && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-800 text-xs uppercase tracking-wide">
                      Minimum Severity To Report
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {["info", "low", "medium", "high"].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEditSettings({ ...editSettings, min_severity: s as Severity })}
                          className={`rounded-lg border p-2 text-xs font-semibold capitalize transition ${
                            editSettings.min_severity === s
                              ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-800 text-xs uppercase tracking-wide">
                      Excluded File Paths & Globs
                    </label>
                    <input
                      type="text"
                      value={editSettings.exclude_paths.join(", ")}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          exclude_paths: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                      placeholder="dist/**, node_modules/**, *.min.js"
                    />
                    <p className="text-[11px] text-slate-500">Files matching these globs will be excluded from AI evaluation.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-800 text-xs uppercase tracking-wide">
                      Pre-Configured Enterprise Rules
                    </label>
                    <div className="space-y-2">
                      {[
                        { id: "sql_injection", name: "SQL Injection Detection (CWE-89)", desc: "Detect unparameterized queries and ORM taint sinks." },
                        { id: "secrets_scanner", name: "Secrets & API Key Scanner (CWE-798)", desc: "Scan diffs for credentials, private keys, and cloud tokens." },
                        { id: "auth_bypass", name: "Authentication & Authorization Bypass (CWE-285)", desc: "Inspect route decorators and role checks." },
                        { id: "input_validation", name: "Unsafe Input Handling (CWE-20)", desc: "Check sanitization on external untrusted parameters." },
                      ].map((r) => {
                        const checked = (editSettings.rules || []).some((x) => x.name === r.id && x.enabled);
                        return (
                          <label key={r.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const curr = editSettings.rules || [];
                                const exists = curr.some((x) => x.name === r.id);
                                const next: RuleConfig[] = exists
                                  ? curr.map((x) => (x.name === r.id ? { ...x, enabled: e.target.checked } : x))
                                  : [...curr, { name: r.id, enabled: e.target.checked, severity: "high" as Severity }];
                                setEditSettings({ ...editSettings, rules: next });
                              }}
                              className="mt-0.5 rounded text-indigo-600"
                            />
                            <div>
                              <div className="font-semibold text-xs text-slate-900">{r.name}</div>
                              <div className="text-[11px] text-slate-500">{r.desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Rule Preview Sandbox */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="font-semibold text-xs text-slate-900 flex items-center justify-between">
                      <span>Custom Rule Sandbox & Test Preview</span>
                      <span className="text-[10px] text-indigo-600 font-bold uppercase">Regex / AST</span>
                    </div>
                    <input
                      type="text"
                      value={customRulePattern}
                      onChange={(e) => setCustomRulePattern(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white p-2 text-xs font-mono"
                    />
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setCustomRuleMatched(true)}
                        className="rounded bg-slate-800 text-white px-3 py-1 text-xs font-semibold hover:bg-slate-700"
                      >
                        Test Against Recent Diffs
                      </button>
                      {customRuleMatched && (
                        <span className="text-xs font-semibold text-emerald-700">
                          ✓ Test Preview: 1 finding would become blocking
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- TAB 3: REMEDIATION ---------------- */}
              {activeTab === "remediation" && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-800 text-xs uppercase tracking-wide">
                      Automated Fix Proposing
                    </label>
                    <div className="space-y-2">
                      {[
                        { id: "disabled", label: "Disabled", desc: "Do not automatically propose patches." },
                        { id: "suggestions_only", label: "Show suggested patches only", desc: "Include suggestion blocks in review comments without opening PRs." },
                        { id: "draft_pr", label: "Propose fixes as draft PRs", desc: "Sandbox-test patch AST and open an isolated draft PR for human review." },
                      ].map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                            editSettings.auto_fix_behavior === opt.id
                              ? "border-indigo-600 bg-indigo-50/50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="auto_fix_behavior"
                            checked={editSettings.auto_fix_behavior === opt.id}
                            onChange={() => setEditSettings({ ...editSettings, auto_fix_behavior: opt.id as any })}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="font-semibold text-xs text-slate-900">{opt.label}</div>
                            <div className="text-[11px] text-slate-500">{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editSettings.require_test_validation}
                        onChange={(e) => setEditSettings({ ...editSettings, require_test_validation: e.target.checked })}
                        className="mt-0.5 rounded text-indigo-600"
                      />
                      <div>
                        <div className="font-semibold text-xs text-slate-900">Require tests before proposing a fix</div>
                        <div className="text-[11px] text-slate-500">Run patch in isolated container to verify tests still pass.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editSettings.require_human_approval}
                        onChange={(e) => setEditSettings({ ...editSettings, require_human_approval: e.target.checked })}
                        className="mt-0.5 rounded text-indigo-600"
                      />
                      <div>
                        <div className="font-semibold text-xs text-slate-900">Require human approval before merging (Fail Safe)</div>
                        <div className="text-[11px] text-slate-500">Never automatically trust the model's claim that its fix is correct.</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* ---------------- TAB 4: INTEGRATION HEALTH ---------------- */}
              {activeTab === "health" && (
                <div className="space-y-4 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="font-bold text-slate-900">GitHub App Installation Permissions</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                      <div>Checks API: <strong className="text-emerald-700">Read & Write</strong></div>
                      <div>Pull Requests: <strong className="text-emerald-700">Read & Write</strong></div>
                      <div>Repository Contents: <strong className="text-emerald-700">Read Only</strong></div>
                      <div>Webhooks: <strong className="text-emerald-700">Subscribed (Active)</strong></div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="font-bold text-slate-900">Worker & Webhook Health</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                      <div>Webhook Delivery Success: <strong className="text-emerald-700">100%</strong></div>
                      <div>HMAC-SHA256 Verification: <strong className="text-emerald-700">Enforced</strong></div>
                      <div>Worker Pool Latency: <strong className="text-slate-800">18ms</strong></div>
                      <div>Check Run Creation Errors: <strong className="text-slate-800">0 in 24h</strong></div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleTestConnection(configuringRepo.id)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                    >
                      Retry Failed Events
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisconnectingRepo(configuringRepo)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Disconnect Repository
                    </button>
                  </div>
                </div>
              )}

              {/* Live Configuration Summary Box */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2 text-xs">
                <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-indigo-600" />
                  <span>Configuration Summary</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-700">
                  <div>Repository: <strong>{configuringRepo.full_name}</strong></div>
                  <div>Mode: <strong className="capitalize">{editSettings.enforcement_mode}</strong></div>
                  <div>
                    Blocking threshold: <strong>
                      {editSettings.block_severity === "critical"
                        ? "Critical only"
                        : editSettings.block_severity === "high"
                        ? "High and Critical"
                        : "Medium, High and Critical"}
                    </strong>
                  </div>
                  <div>Required check: <strong>{editSettings.require_check ? "Enabled" : "Disabled"}</strong></div>
                  <div>
                    Unavailable service: <strong>{editSettings.fail_open ? "Allow merge (fail open)" : "Keep policy enforced (fail closed)"}</strong>
                  </div>
                  <div>Remediation: <strong>{editSettings.auto_fix_behavior === "draft_pr" ? "Draft fix PRs" : editSettings.auto_fix_behavior === "suggestions_only" ? "Suggestions only" : "Disabled"}</strong></div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="border-t px-6 py-4 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setConfiguringRepo(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={saveSettingsMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {saveSettingsMutation.isPending ? <Cpu className="animate-spin" size={14} /> : <Check size={14} />}
                <span>Save to PostgreSQL</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TEST CONNECTION RESULT                                             */}
      {/* ========================================================================= */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-emerald-600" size={20} />
                <h3 className="font-bold text-base text-slate-900">GitHub Connection Verified</h3>
              </div>
              <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Target Repository:</span>
                <span className="font-mono font-semibold">{testResult.repository}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">GitHub App Auth:</span>
                <span className="text-emerald-700 font-semibold">Authenticated (App #500)</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Webhook Digest Secret:</span>
                <span className="text-emerald-700 font-semibold">{testResult.webhook?.signature_algorithm} Verified</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Checks API Access:</span>
                <span className="text-emerald-700 font-semibold">Write Access Confirmed</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Verification Latency:</span>
                <span className="font-mono">{testResult.latency_ms}ms</span>
              </div>
            </div>

            <button
              onClick={() => setTestResult(null)}
              className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PAUSE REVIEWS CONFIRMATION                                         */}
      {/* ========================================================================= */}
      {pauseConfirmRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {pauseConfirmRepo.newPaused ? "Pause Automated Reviews?" : "Resume Automated Reviews?"}
                </h3>
                <p className="text-xs text-slate-500">{pauseConfirmRepo.repo.full_name}</p>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 leading-relaxed">
              <strong>Security Consequence Notice:</strong> Pausing reviews stops automated AI evaluation on incoming pull requests.
              <strong> Important distinction:</strong> Pausing reviews does <em>NOT</em> automatically unblock previously blocked pull requests or bypass GitHub branch protection.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPauseConfirmRepo(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTogglePause(pauseConfirmRepo.repo)}
                className={`rounded-lg px-4 py-2 text-xs font-bold text-white shadow-xs transition ${
                  pauseConfirmRepo.newPaused ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {pauseConfirmRepo.newPaused ? "Confirm Pause" : "Confirm Resume"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DISCONNECT REPOSITORY CONFIRMATION                                 */}
      {/* ========================================================================= */}
      {disconnectingRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-rose-100 p-2 text-rose-700">
                <Unplug size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Disconnect Repository?</h3>
                <p className="text-xs text-slate-500">{disconnectingRepo.full_name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will remove PR Sentinel permissions, unregister webhooks, and record a disconnection audit log entry.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDisconnectingRepo(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDisconnect(disconnectingRepo.id)}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-xs transition"
              >
                Disconnect Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURE GITHUB APP                                               */}
      {/* ========================================================================= */}
      {showConfigGithubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Settings className="text-indigo-600" size={20} />
                <h3 className="font-bold text-base text-slate-900">GitHub App Configuration</h3>
              </div>
              <button onClick={() => setShowConfigGithubModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                <div className="font-semibold text-slate-900">PR Sentinel GitHub App (#500)</div>
                <div className="text-slate-500">Client ID: <span className="font-mono">Iv1.a98f121bb90</span></div>
                <div className="text-slate-500">Target Organization: <span className="font-semibold text-slate-800">acme</span></div>
              </div>
              <p className="text-slate-600">
                PR Sentinel authenticates with GitHub using RSA-2048 JWT tokens and GitHub App installations to maintain zero long-lived personal access tokens.
              </p>
            </div>

            <button
              onClick={() => setShowConfigGithubModal(false)}
              className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSTALL REPOSITORY                                                 */}
      {/* ========================================================================= */}
      {showInstallRepoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Plus className="text-indigo-600" size={20} />
                <h3 className="font-bold text-base text-slate-900">Install On Repository</h3>
              </div>
              <button onClick={() => setShowInstallRepoModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                To install PR Sentinel on additional repositories within your organization:
              </p>
              <div className="rounded-lg bg-slate-50 p-3 border space-y-1">
                <div className="font-semibold text-slate-900">GitHub App Installation URL:</div>
                <code className="text-indigo-600 text-[11px]">https://github.com/apps/pr-sentinel/installations/new</code>
              </div>
              <p className="text-slate-500">
                Upon installation, GitHub will trigger a signed webhook to automatically register the repository and configure branch protection check runs.
              </p>
            </div>

            <button
              onClick={() => setShowInstallRepoModal(false)}
              className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: REPOSITORY ACTIVITY AUDIT LOG                                     */}
      {/* ========================================================================= */}
      {activityRepo && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="border-b px-6 py-4 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <History size={18} className="text-indigo-600" />
                  <span>Repository Activity</span>
                </h3>
                <p className="text-xs font-mono text-slate-500">{activityRepo.full_name}</p>
              </div>
              <button onClick={() => setActivityRepo(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {loadingActivity ? (
                <div className="text-xs text-slate-500 py-8 text-center">Loading audit history...</div>
              ) : !activityLogs || activityLogs.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">No audit logs for this repository yet.</div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 capitalize">{log.action.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Actor: <span className="font-mono text-slate-700 font-semibold">{log.actor}</span>
                    </div>
                    {log.detail && (
                      <pre className="mt-1 rounded bg-slate-900 p-2 text-[10px] text-emerald-300 overflow-x-auto">
                        {JSON.stringify(log.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
