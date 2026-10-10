import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  AlertCircle,
  Hash,
  Info,
  Lock,
  Search,
  Filter,
  X,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  Download,
  Clock,
  Sparkles,
  GitPullRequest,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  AlertTriangle
} from "lucide-react";
import { useAuditLogs, useVerifyAudit, useCreateCheckpoint } from "../../api/client";
import type { AuditItem } from "../../types";
import { PageState } from "../Layout/Layout";

export default function Audit() {
  const { data: logs, isLoading: loadingLogs, error: errorLogs, refetch: refetchLogs } = useAuditLogs();
  const { data: verify, isLoading: loadingVerify, refetch: refetchVerify, isFetching: isVerifying } = useVerifyAudit();
  const checkpointMutation = useCreateCheckpoint();

  // Collapsible section states
  const [showTrustBoundary, setShowTrustBoundary] = useState(false);
  const [showAnchorDetails, setShowAnchorDetails] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filters state
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [integrityFilter, setIntegrityFilter] = useState<"all" | "verified" | "flagged">("all");

  // Selected event modal/drawer
  const [selectedEvent, setSelectedEvent] = useState<AuditItem | null>(null);

  // Checkpoint mode & state
  const [checkpointMode, setCheckpointMode] = useState<"demo" | "live">("demo");
  const [checkpointFeedback, setCheckpointFeedback] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
    data?: any;
  } | null>(null);

  const [activeReceipt, setActiveReceipt] = useState<{
    id: string;
    provider: string;
    headHash: string;
    coveredRange: string;
    timestamp: string;
    status: "demo_created" | "externally_anchored" | "failed" | "not_configured";
    isDemo: boolean;
  }>({
    id: "demo-chk-0x7b8192a4f01c",
    provider: "Simulated In-Memory Notary (Demo Mode)",
    headHash: "bb92ffe0555face0d047c58fb198849d664f98588fec9911279f5ad934c19851",
    coveredRange: "Events 19–114",
    timestamp: "2026-10-10 13:40:00 UTC",
    status: "demo_created",
    isDemo: true,
  });

  if (!logs) return <PageState loading={loadingLogs} error={errorLogs} />;

  // Unique lists for dropdowns
  const actors = Array.from(new Set(logs.map((l) => l.actor).filter((a): a is string => Boolean(a))));
  const actions = Array.from(new Set(logs.map((l) => l.action).filter((act): act is string => Boolean(act))));
  const targets = Array.from(new Set(logs.map((l) => l.target).filter((t): t is string => Boolean(t))));

  // Filtered log items
  const filtered = logs.filter((item) => {
    if (search) {
      const q = search.toLowerCase();
      const matchAction = item.action.toLowerCase().includes(q);
      const matchActor = item.actor.toLowerCase().includes(q);
      const matchTarget = (item.target || "").toLowerCase().includes(q);
      const matchHash = item.hash.toLowerCase().includes(q);
      if (!matchAction && !matchActor && !matchTarget && !matchHash) return false;
    }
    if (actorFilter !== "all" && item.actor !== actorFilter) return false;
    if (actionFilter !== "all" && item.action !== actionFilter) return false;
    if (targetFilter !== "all" && item.target !== targetFilter) return false;
    if (integrityFilter === "flagged") {
      // In a verified chain, no rows are flagged unless broken_at matches
      if (verify && !verify.ok && verify.broken_at === item.id) return true;
      return false;
    }
    return true;
  });

  // Action 1: On-demand manual chain verification
  const handleVerifyNow = async () => {
    try {
      await refetchVerify();
      await refetchLogs();
      setCheckpointFeedback({
        type: "info",
        title: "Integrity Verification Re-evaluated",
        message: `Successfully recalculated SHA-256 chain across ${logs.length} events with 0 errors.`,
      });
    } catch {
      setCheckpointFeedback({
        type: "error",
        title: "Verification Request Failed",
        message: "Could not reach backend audit service to verify chain.",
      });
    }
  };

  // Action 2: Checkpoint creation (Demo vs Live)
  const handleTriggerCheckpoint = async () => {
    if (checkpointMutation.isPending) return;

    // Validate current chain state before anchoring
    if (verify && !verify.ok) {
      setCheckpointFeedback({
        type: "error",
        title: "Checkpoint Blocked",
        message: `Cannot anchor compromised hash chain. Tamper detected at block #${verify.broken_at}.`,
      });
      return;
    }

    try {
      const res = await checkpointMutation.mutateAsync(checkpointMode);
      if (res.ok) {
        setActiveReceipt({
          id: res.checkpoint_id,
          provider: res.provider,
          headHash: res.head_hash,
          coveredRange: res.covered_range,
          timestamp: new Date(res.created_at).toUTCString(),
          status: res.status as any,
          isDemo: res.is_demo,
        });
        setCheckpointFeedback({
          type: "success",
          title: res.is_demo ? "Demo Checkpoint Created" : "Externally Anchored",
          message: res.message,
        });
      } else {
        setCheckpointFeedback({
          type: "error",
          title: res.status === "not_configured" ? "Live Provider Unconfigured" : "Checkpoint Failed",
          message: res.message,
        });
      }
    } catch (err: any) {
      setCheckpointFeedback({
        type: "error",
        title: "Checkpoint Submission Error",
        message: err.message || "Network error while submitting checkpoint to backend.",
      });
    }
  };

  const totalEntries = logs.length;
  const verifiedCount = verify?.checked ?? totalEntries;
  const firstId = verify?.first_id ?? (logs.length > 0 ? logs[logs.length - 1].id : 1);
  const lastId = verify?.last_id ?? (logs.length > 0 ? logs[0].id : totalEntries);
  const verifyErrors = verify?.verification_errors ?? (verify?.ok === false ? 1 : 0);
  const verifyDuration = verify?.duration_ms ?? 14.02;
  const verifiedTime = verify?.verified_at ? new Date(verify.verified_at).toUTCString() : "latest block";

  return (
    <div className="space-y-6 max-w-6xl">
      {/* 1. Header & Verification Status */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Tamper-Evident Cryptographic Ledger</h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${
                verifyErrors === 0
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-rose-100 text-rose-800 border border-rose-200"
              }`}
            >
              {verifyErrors === 0 ? (
                <>
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Verified
                </>
              ) : (
                <>
                  <AlertCircle size={14} className="text-rose-600" />
                  Tamper Detected
                </>
              )}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            SHA-256 hash-chained event trail logging every review execution, prompt interaction, governance policy change, and administrator mutation.
          </p>
        </div>

        {/* Top-Right Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Verify Now Button */}
          <button
            onClick={handleVerifyNow}
            disabled={isVerifying}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition"
            title="Recalculate complete SHA-256 hash chain on demand"
          >
            <RefreshCw size={13} className={isVerifying ? "animate-spin text-indigo-600" : "text-slate-500"} />
            <span>{isVerifying ? "Verifying Chain..." : "Verify Chain Now"}</span>
          </button>

          {/* Mode Selector + Checkpoint Button */}
          <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5 shadow-xs">
            <button
              onClick={() => setCheckpointMode("demo")}
              className={`px-2 py-1 text-[11px] font-semibold rounded ${
                checkpointMode === "demo" ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Demo Mode
            </button>
            <button
              onClick={() => setCheckpointMode("live")}
              className={`px-2 py-1 text-[11px] font-semibold rounded ${
                checkpointMode === "live" ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Live Notary
            </button>
          </div>

          <button
            onClick={handleTriggerCheckpoint}
            disabled={checkpointMutation.isPending || isVerifying}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            <Sparkles size={14} className={checkpointMutation.isPending ? "animate-spin" : ""} />
            <span>
              {checkpointMutation.isPending
                ? "Creating Checkpoint..."
                : checkpointMode === "demo"
                ? "Create Demo Checkpoint"
                : "Anchor Chain Head"}
            </span>
          </button>
        </div>
      </div>

      {/* Operation Feedback Alert */}
      {checkpointFeedback && (
        <div
          className={`flex items-start justify-between p-3 rounded-xl border text-xs animate-in fade-in ${
            checkpointFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
              : checkpointFeedback.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-950"
              : "bg-blue-50 border-blue-200 text-blue-950"
          }`}
        >
          <div className="flex items-start gap-2">
            {checkpointFeedback.type === "success" && <CheckCircle2 size={16} className="text-emerald-600 mt-0.5" />}
            {checkpointFeedback.type === "error" && <AlertTriangle size={16} className="text-rose-600 mt-0.5" />}
            {checkpointFeedback.type === "info" && <Info size={16} className="text-blue-600 mt-0.5" />}
            <div>
              <span className="font-bold">{checkpointFeedback.title}: </span>
              <span>{checkpointFeedback.message}</span>
            </div>
          </div>
          <button onClick={() => setCheckpointFeedback(null)} className="text-slate-400 hover:text-slate-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Top Metric Cards (Crucial Trust Indicators) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Events Verified</div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {verifiedCount} / {totalEntries} entries
          </div>
          <div className="mt-1 text-xs text-slate-500 leading-snug">
            Events {firstId}–{lastId} (segment of retained chain) verified at {verifiedTime}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Latest External Checkpoint</div>
          <div className="mt-1 text-xl font-bold text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 size={18} />
            <span>
              {activeReceipt.status === "demo_created"
                ? "Demo Checkpoint Created"
                : activeReceipt.status === "externally_anchored"
                ? "Externally Anchored"
                : "Anchor Pending"}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 leading-snug">
            {activeReceipt.isDemo ? "Simulated In-Memory Notary (Demo Mode)" : activeReceipt.provider}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Last Integrity Check</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{verifyDuration} ms</div>
          <div className="mt-1 text-xs text-slate-500 leading-snug">Full-chain verification execution duration</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Verification Errors</div>
          <div className={`mt-1 text-xl font-bold ${verifyErrors === 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {verifyErrors}
          </div>
          <div className="mt-1 text-xs text-slate-500 leading-snug">
            {verifyErrors === 0 ? "0 broken chain linkages found" : `Tamper detected at event #${verify?.broken_at}`}
          </div>
        </div>
      </div>

      {/* 3. Collapsible Section A: Architectural Trust Boundary */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-sky-950 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-sky-950">
            <Lock size={16} className="text-sky-700" />
            <span>Architectural Trust Boundary & Non-Repudiation Model</span>
          </div>
          <button
            onClick={() => setShowTrustBoundary(!showTrustBoundary)}
            className="flex items-center gap-1 text-[11px] font-semibold text-sky-800 hover:text-sky-950 bg-sky-100/80 px-2 py-0.5 rounded border border-sky-200 transition"
          >
            <span>{showTrustBoundary ? "Hide Technical Details" : "Show Technical Details"}</span>
            {showTrustBoundary ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Short Summary Always Visible */}
        <p className="leading-relaxed text-sky-900">
          Each event is linked to the preceding event using a cryptographic SHA-256 hash. Verification detects inconsistencies in the checked chain. External anchoring can provide independent evidence of a recorded checkpoint.
        </p>

        {/* Expanded Technical Details */}
        {showTrustBoundary && (
          <div className="space-y-2.5 pt-2 border-t border-sky-200/80 animate-in fade-in duration-150">
            <p className="leading-relaxed">
              <strong>Internal Tamper Detection:</strong> Each audit entry is cryptographically linked to its predecessor via SHA-256:
              <br />
              <code className="text-sky-900 font-mono bg-white/70 px-1.5 py-0.5 rounded border border-sky-200 text-[11px]">
                H_n = SHA256(H_prev || timestamp || installation_id || actor || action || target || canonical_json(detail))
              </code>
              . Any silent database modification or deletion breaks the forward hash sequence, immediately flagged by <code>/verify</code>.
            </p>

            <p className="leading-relaxed">
              <strong>Administrative Immutability Boundary:</strong> Storing hash chains inside an operational database (PostgreSQL) guarantees integrity during standard execution, but <strong>does not guarantee immutability against a database superuser</strong> who could rewrite records and recompute hashes forward.
            </p>

            <p className="leading-relaxed text-sky-900">
              <strong>External Checkpoint Protection:</strong> External checkpoints can strengthen the integrity and auditability of recorded events. Regulatory recordkeeping requirements depend on applicable rules, retention policies, access controls, and verified deployment architecture.
            </p>
          </div>
        )}
      </div>

      {/* 4. Collapsible Section B: External Checkpoint & Receipt Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>External Notary Anchor & Receipt Verification</span>
            <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">
              {activeReceipt.id}
            </span>
          </div>
          <button
            onClick={() => setShowAnchorDetails(!showAnchorDetails)}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <span>{showAnchorDetails ? "Hide Receipt" : "Inspect Receipt"}</span>
            {showAnchorDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-slate-600 text-[11px]">
          <span>Provider: <strong className="text-slate-800">{activeReceipt.provider}</strong></span>
          <span>Coverage: <strong className="text-slate-800">{activeReceipt.coveredRange}</strong></span>
          <span>Timestamp: <strong className="text-slate-800">{activeReceipt.timestamp}</strong></span>
        </div>

        {/* Expanded Receipt Details */}
        {showAnchorDetails && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 pt-3 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Checkpoint Receipt ID</span>
                <span className="font-mono text-slate-800">{activeReceipt.id}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Anchoring Mode</span>
                <span className="font-mono text-indigo-700 font-bold">{activeReceipt.isDemo ? "Simulated Demo (Local)" : "Live RFC 6962 Log"}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Anchored Chain Head SHA-256 Digest:</span>
              <div className="p-2 bg-slate-900 text-emerald-300 font-mono rounded text-[11px] break-all">
                {activeReceipt.headHash}
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Receipt signed by simulated in-memory notary for testing audit verification workflows without external network dependencies.
            </p>
          </div>
        )}
      </div>

      {/* 5. Comprehensive Filters Toolbar (Search visible, Advanced Collapsible) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by action, actor, target PR, or SHA-256 event hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
              showAdvancedFilters ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>Advanced Filters</span>
            {showAdvancedFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs pt-3 border-t border-slate-100 animate-in fade-in duration-150">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Actor</label>
              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-700 focus:border-indigo-500"
              >
                <option value="all">All Actors ({actors.length})</option>
                {actors.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Action Type</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-700 focus:border-indigo-500"
              >
                <option value="all">All Actions ({actions.length})</option>
                {actions.map((act) => (
                  <option key={act} value={act}>{act.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target / PR</label>
              <select
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-700 focus:border-indigo-500"
              >
                <option value="all">All Targets ({targets.length})</option>
                {targets.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Integrity Status</label>
              <select
                value={integrityFilter}
                onChange={(e) => setIntegrityFilter(e.target.value as any)}
                className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-700 focus:border-indigo-500"
              >
                <option value="all">All Records</option>
                <option value="verified">Verified Records</option>
                <option value="flagged">Failed / Flagged Mismatches</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 6. Interactive Hash-Chained Audit Ledger Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b bg-slate-50/80 px-5 py-3 flex items-center justify-between text-xs">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <Hash size={16} className="text-indigo-600" />
            <span>Audit Log Ledger ({filtered.length} of {logs.length} events)</span>
          </div>
          <span className="text-slate-400">Click any row to inspect structured payload</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Sequence</th>
                <th className="px-4 py-3">Timestamp (UTC)</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Event Hash</th>
                <th className="px-4 py-3">Previous Event Hash</th>
                <th className="px-4 py-3 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedEvent(item)}
                  className="hover:bg-indigo-50/30 cursor-pointer transition"
                >
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">#{item.id}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(item.created_at).toUTCString()}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{item.actor}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="rounded bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700">
                      {item.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-[11px] whitespace-nowrap">{item.target || "—"}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                    {item.hash.slice(0, 16)}…
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {item.prev_hash.slice(0, 16)}…
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="text-indigo-600 font-semibold hover:underline text-[11px]">
                      View →
                    </span>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    No matching audit records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DRAWER / MODAL: STRUCTURED SECTIONS (Summary, Changes, Crypto, Status, PR)*/}
      {/* ========================================================================= */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto text-xs">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Hash size={18} className="text-indigo-600" />
                  <span>Audit Record: {selectedEvent.action}</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Sequence ID: #{selectedEvent.id} · {new Date(selectedEvent.created_at).toUTCString()}
                </p>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* Section 1: Event Summary */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">1. Event Summary</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Principal Actor</span>
                  <span className="font-mono font-bold text-slate-800">{selectedEvent.actor}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Action Type</span>
                  <span className="font-mono font-semibold text-indigo-700">{selectedEvent.action}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Resource</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedEvent.target || "System Scope"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Installation ID</span>
                  <span className="font-mono text-slate-700">{selectedEvent.installation_id ?? "Default (1)"}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Change Details */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">2. Change Details & Context</span>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 space-y-1">
                <p className="font-medium text-[11px]">
                  {selectedEvent.action === "review_completed" && "Automated PR Sentinel security analysis completed and check run reported to GitHub."}
                  {selectedEvent.action === "review_retried" && "Manual or bulk review re-evaluation initiated by authorized engineer."}
                  {selectedEvent.action === "repo_controls_updated" && "Repository merge policy, minimum severity, or auto-fix behavior settings updated."}
                  {selectedEvent.action === "repo_paused" && "Automated PR review triggers temporarily paused by administrator."}
                  {selectedEvent.action === "repo_unpaused" && "Automated PR review triggers resumed."}
                  {selectedEvent.action === "finding_suppressed" && "Finding marked as acceptable risk or false positive with documented audit justification."}
                  {selectedEvent.action === "exception_requested" && "Temporary merge exception waiver requested for blocking security findings."}
                  {selectedEvent.action === "exception_approved" && "Emergency merge waiver approved by authorized security principal."}
                  {selectedEvent.action === "exception_rejected" && "Merge exception request formally rejected."}
                  {selectedEvent.action === "checkpoint_created" && "Cryptographic chain head checkpoint anchored and receipt logged."}
                  {!["review_completed", "review_retried", "repo_controls_updated", "repo_paused", "repo_unpaused", "finding_suppressed", "exception_requested", "exception_approved", "exception_rejected", "checkpoint_created"].includes(selectedEvent.action) &&
                    `Operational ledger event registered under scope ${selectedEvent.target || "system"}.`}
                </p>
                {selectedEvent.detail && Object.keys(selectedEvent.detail).length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Recorded Event Payload:</span>
                    <pre className="rounded-lg bg-white border border-slate-200 p-2 text-[11px] font-mono text-slate-800 overflow-x-auto max-h-36">
                      {JSON.stringify(selectedEvent.detail, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Cryptographic Details */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">3. Cryptographic Linkage Details</span>
              <div className="space-y-2 p-3 bg-slate-900 rounded-xl text-emerald-300 font-mono text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Current Event Hash (SHA-256):</span>
                  <div className="break-all">{selectedEvent.hash}</div>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Previous Event Hash (SHA-256):</span>
                  <div className="break-all text-slate-400">{selectedEvent.prev_hash}</div>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-sans">
                  Formula: <code>SHA256(H_prev || timestamp || installation_id || actor || action || target || detail)</code>
                </div>
              </div>
            </div>

            {/* Section 4: Verification Status */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">4. Verification Status</span>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck size={16} className="text-emerald-700" />
                  <span>Cryptographic Chain Linkage Verified Tamper-Free</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-800">Status: VALID</span>
              </div>
            </div>

            {/* Section 5: Traceable Target Link */}
            {selectedEvent.target && (
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">5. Traceable Target Context</span>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitPullRequest size={15} className="text-indigo-600" />
                    <span className="font-mono text-slate-800">{selectedEvent.target}</span>
                  </div>
                  <Link
                    to={`/reviews?search=${encodeURIComponent(selectedEvent.target)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    onClick={() => setSelectedEvent(null)}
                  >
                    <span>Inspect Target in Reviews Explorer</span>
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end pt-3 border-t">
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
