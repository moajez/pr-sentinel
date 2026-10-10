import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { useOverview } from "../../api/client";
import type { Severity } from "../../types";
import { PageState, SEVERITY_COLORS } from "../Layout/Layout";

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useOverview();
  if (!data) return <PageState loading={isLoading} error={error} />;

  const tokens = data.prompt_tokens + data.completion_tokens;
  const sev = Object.entries(data.severity_distribution).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">Engineering Overview</h1>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
              Sample Benchmark Dataset
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Real-time pipeline metrics across code quality, review latency, LLM token consumption, and vulnerability distribution.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 flex items-center justify-between">
        <div>
          <strong>Environment Mode:</strong> Showing seeded benchmark data across sample repositories (<code>acme/payments-api</code>, <code>acme/web-frontend</code>).
          Live reviews from installed GitHub repositories are automatically ingested, parsed, and updated here.
        </div>
      </div>

      {/* Enterprise Capabilities Highlights */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/cicd"
          className="group rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/70 to-white p-4 shadow-xs hover:border-blue-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              GitHub App & CI/CD
            </span>
            <span className="text-xs font-medium text-blue-600 group-hover:translate-x-0.5 transition-transform">Explore →</span>
          </div>
          <h3 className="mt-2.5 text-sm font-semibold text-slate-900">Signed Webhooks & Checks</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Webhook signature verification, 4-tab repository config drawer, and Branch Protection merge gate.
          </p>
        </Link>

        <Link
          to="/reviews"
          className="group rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white p-4 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
              Reviews Explorer
            </span>
            <span className="text-xs font-medium text-indigo-600 group-hover:translate-x-0.5 transition-transform">Explore →</span>
          </div>
          <h3 className="mt-2.5 text-sm font-semibold text-slate-900">Triage & Exception Gate</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            5-section PR drawer with "Why it matters", commit diff comparison, finding suppression, and rerun.
          </p>
        </Link>

        <Link
          to="/identity"
          className="group rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Enterprise Security
            </span>
            <span className="text-xs font-medium text-emerald-600 group-hover:translate-x-0.5 transition-transform">Explore →</span>
          </div>
          <h3 className="mt-2.5 text-sm font-semibold text-slate-900">RBAC & Tenant Isolation</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            4-tier RBAC, installation-scoped isolation, pre-LLM secret redaction, and Redis rate limiting.
          </p>
        </Link>

        <Link
          to="/remediation"
          className="group rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/70 to-white p-4 shadow-xs hover:border-purple-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
              Safe Remediation
            </span>
            <span className="text-xs font-medium text-purple-600 group-hover:translate-x-0.5 transition-transform">Explore →</span>
          </div>
          <h3 className="mt-2.5 text-sm font-semibold text-slate-900">Evidence & Sandbox AST</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Evidence-backed findings with confidence scoring and sandbox testing before opening Draft PRs.
          </p>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Avg latency" value={`${(data.avg_latency_ms / 1000).toFixed(1)}s`} sub={`${data.completed_reviews} completed`} />
        <Card label="Token usage" value={tokens.toLocaleString()} sub={`${data.prompt_tokens.toLocaleString()} in / ${data.completion_tokens.toLocaleString()} out`} />
        <Card label="Cost estimate" value={`$${data.total_cost_usd.toFixed(4)}`} sub={`${data.total_reviews} reviews`} />
        <Card label="Avg quality" value={data.avg_quality_score != null ? `${data.avg_quality_score.toFixed(1)}/10` : "—"} sub={`${data.total_findings} findings`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-medium">Reviews per day</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="reviews" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-medium">Severity distribution</h2>
          {sev.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">No findings yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={sev} dataKey="value" nameKey="name" outerRadius={90} label>
                  {sev.map((s) => (
                    <Cell key={s.name} fill={SEVERITY_COLORS[s.name as Severity] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

