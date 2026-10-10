import { Link, useParams } from "react-router-dom";
import { ShieldCheck, ShieldAlert, GitPullRequest, CheckCircle2, Code2, AlertTriangle, ExternalLink } from "lucide-react";
import { useReview } from "../../api/client";
import type { Finding } from "../../types";
import { PageState, SeverityBadge, StatusBadge } from "../Layout/Layout";

export default function ReviewDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useReview(id);
  if (!data) return <PageState loading={isLoading} error={error} />;

  const byFile = (data.findings || []).reduce<Record<string, Finding[]>>((acc, f) => {
    (acc[f.file_path] ??= []).push(f);
    return acc;
  }, {});

  const violations = data.policy_violations?.violations || [];

  return (
    <div className="space-y-6 max-w-5xl">
      <Link to="/reviews" className="text-sm font-medium text-indigo-700 hover:underline">
        ← Back to Review Explorer
      </Link>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {data.repo}#{data.pr_number}
            </h1>
            <StatusBadge status={data.status} />
            {data.merge_blocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-0.5 text-xs font-bold text-rose-800 border border-rose-300">
                <ShieldAlert size={14} className="text-rose-600" /> Merge Blocked
              </span>
            ) : data.status === "completed" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300">
                <ShieldCheck size={14} className="text-emerald-600" /> Merge Permitted
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {data.pr_title || "Untitled Pull Request"} · authored by <strong>{data.author || "unknown"}</strong> · commit <code>{data.commit_sha.slice(0, 7)}</code>
          </p>
        </div>

        {data.fix_pr_url && (
          <a
            href={data.fix_pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition"
          >
            <GitPullRequest size={15} />
            <span>View Verified Draft PR</span>
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
        <Stat l="Code Quality" v={data.code_quality_score != null ? `${data.code_quality_score}/10` : "—"} sub="Calculated Score" />
        <Stat l="Execution Latency" v={`${(data.latency_ms / 1000).toFixed(2)}s`} sub="Pipeline runtime" />
        <Stat l="Token Consumption" v={(data.prompt_tokens + data.completion_tokens).toLocaleString()} sub={`${data.prompt_tokens} in / ${data.completion_tokens} out`} />
        <Stat l="LLM Cost" v={`$${data.estimated_cost_usd.toFixed(4)}`} sub={data.model_used || "Standard model"} />
      </div>

      {/* Branch Protection & Merge Gate Banner */}
      {data.status === "completed" && (
        <div
          className={`rounded-xl border p-4.5 text-sm space-y-2 ${
            data.merge_blocked
              ? "border-rose-300 bg-rose-50 text-rose-950"
              : "border-emerald-300 bg-emerald-50 text-emerald-950"
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {data.merge_blocked ? (
              <>
                <ShieldAlert size={20} className="text-rose-600" />
                <span>GitHub Branch Protection: Pull Request Blocked from Merging</span>
              </>
            ) : (
              <>
                <ShieldCheck size={20} className="text-emerald-600" />
                <span>GitHub Branch Protection: Security & Compliance Check Passed</span>
              </>
            )}
          </div>
          <p className="text-xs leading-relaxed">
            {data.merge_blocked
              ? "PR Sentinel published a Check Run with conclusion='failure'. GitHub branch protection requires resolving all policy violations before merge."
              : "All organizational merge gate criteria, severity ceilings, and quality thresholds are fully satisfied. GitHub Check Run concluded with 'success'."}
          </p>
          {violations.length > 0 && (
            <div className="pt-2 border-t border-rose-200 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900">Enforced Violations:</span>
              {violations.map((v) => (
                <div key={v} className="text-xs text-rose-800 flex items-start gap-1.5">
                  <span className="font-bold text-rose-700">•</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Safe Remediation Notice */}
      {data.fix_pr_url && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-950 space-y-1.5">
          <div className="font-bold flex items-center gap-2 text-purple-900">
            <CheckCircle2 size={16} className="text-purple-600" />
            <span>Safe Remediation Proposal (Verified in Isolated Sandbox)</span>
          </div>
          <p className="leading-relaxed">
            Never automatically trust a model's claim that its own fix is correct. Each patch was tested in an isolated sandbox for syntax and AST compilation
            before opening a Draft PR into the head branch. Human engineer review and approval is required.
          </p>
        </div>
      )}

      {/* Security Notices */}
      {data.defense_triggered && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-center gap-2.5">
          <AlertTriangle size={18} className="text-amber-700 shrink-0" />
          <span>
            <strong>Adversarial Content Guard Triggered:</strong> Untrusted code diff or PR content contained prompt-injection patterns. Content was quarantined and evaluated as inert data.
          </span>
        </div>
      )}

      {data.error_message && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <span>⚠️ Review Pipeline Execution Failure</span>
          </div>
          <p className="font-mono text-xs text-rose-800">{data.error_message}</p>
        </div>
      )}

      {/* Summary Markdown */}
      {data.summary_markdown && (
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-2">
          <h2 className="text-sm font-bold text-slate-800">Executive Summary</h2>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{data.summary_markdown}</p>
        </div>
      )}

      {/* Evidence-Backed Findings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Evidence-Backed Findings ({(data.findings || []).length})
          </h2>
          <span className="text-xs text-slate-500">Includes taint flow, confidence scores, and sandbox verification</span>
        </div>

        {Object.entries(byFile).map(([file, findings]) => (
          <div key={file} className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-4 py-2.5 font-mono text-xs font-semibold text-slate-800 flex items-center gap-2">
              <Code2 size={15} className="text-slate-500" />
              <span>{file}</span>
              <span className="ml-auto text-[11px] font-normal text-slate-500">{findings.length} item(s)</span>
            </div>

            <div className="divide-y divide-slate-100">
              {findings.map((f) => (
                <div key={f.id} className="p-5 space-y-3 hover:bg-slate-50/50 transition">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <span className="font-bold text-slate-900 text-sm">{f.title}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium">{f.category}</span>
                    {f.cwe && <span className="rounded bg-purple-50 px-2 py-0.5 font-mono text-xs font-bold text-purple-700">{f.cwe}</span>}
                    {f.line_start != null && (
                      <span className="font-mono text-xs text-slate-500">line {f.line_start}</span>
                    )}

                    {/* Confidence Score Pill */}
                    {f.confidence != null && (
                      <span className="ml-auto rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                        🎯 {Math.round(f.confidence * 100)}% Confidence
                      </span>
                    )}

                    {/* Sandbox Verification Pill */}
                    {f.fix_verification_status && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Sandbox Verified
                      </span>
                    )}
                  </div>

                  {/* Technical Explanation */}
                  <p className="text-sm text-slate-700 leading-relaxed">{f.description}</p>

                  {/* Affected Code Snippet */}
                  {f.code_snippet && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Affected Code:</span>
                      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs font-mono text-slate-100">
                        {f.code_snippet}
                      </pre>
                    </div>
                  )}

                  {/* Supporting Evidence / Taint Flow */}
                  {f.evidence && (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-950 space-y-1">
                      <span className="font-bold flex items-center gap-1.5 text-indigo-900">
                        <span>🔍 Supporting Evidence & Taint Analysis:</span>
                      </span>
                      <p className="leading-relaxed text-indigo-900">{f.evidence}</p>
                    </div>
                  )}

                  {/* Suggested Fix */}
                  {f.suggested_fix && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Proposed Remediation (GitHub 1-Click Suggestion):</span>
                      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs font-mono text-emerald-300">
                        {f.suggested_fix}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {(!data.findings || data.findings.length === 0) && (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">
            No security findings or flaws recorded for this pull request.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ l, v, sub }: { l: string; v: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{l}</div>
      <div className="mt-1 text-xl font-extrabold text-slate-900">{v}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
