import { Users, Shield, KeyRound, Lock, EyeOff, Activity, UserCheck } from "lucide-react";
import { useMembers, useRepos } from "../../api/client";
import { PageState } from "../Layout/Layout";

const ROLES_INFO = [
  {
    role: "admin",
    title: "Organization Administrator",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    desc: "Complete authority over organization policies, budgets, repository settings, audit ledgers, and user provisioning.",
  },
  {
    role: "security_reviewer",
    title: "Security Reviewer",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    desc: "Can approve or dismiss findings, trigger automated fix proposals, and configure repository rules.",
  },
  {
    role: "developer",
    title: "Developer (Engineer)",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    desc: "Access to review PR analysis, inspect findings, and adopt suggested remediations for assigned repositories.",
  },
  {
    role: "auditor",
    title: "Compliance Auditor",
    badge: "bg-slate-100 text-slate-800 border-slate-300",
    desc: "Read-only access to cryptographic audit trail, compliance gates, and regulatory mapping evidence.",
  },
];

export default function EnterpriseSecurity() {
  const { data: members, isLoading: loadingMembers, error: errorMembers } = useMembers();
  const { data: repos, isLoading: loadingRepos, error: errorRepos } = useRepos();

  if (!members || !repos) return <PageState loading={loadingMembers || loadingRepos} error={errorMembers || errorRepos} />;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="text-indigo-600" size={24} />
          <h1 className="text-2xl font-bold text-slate-900">Enterprise Identity & Data Security</h1>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Strict multi-tenant boundary segregation, granular role-based access control (RBAC), pre-LLM secret redaction, and source code privacy.
        </p>
      </div>

      {/* Security Architecture Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-slate-900">Tenant Isolation</span>
            <Lock className="text-indigo-600" size={18} />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">100% Segregated</div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Every repository, review, and audit entry is strictly partitioned by <code>installation_id</code>. Cross-tenant access is rejected with HTTP 404 to prevent IDOR leaks.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-slate-900">Source Privacy</span>
            <EyeOff className="text-emerald-600" size={18} />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">Zero Retention</div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Proprietary customer source trees are never stored in databases or on disk. Memory is freed immediately after analysis; only minimal anchored diff snippets are kept.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-slate-900">Rate Limiting</span>
            <Activity className="text-purple-600" size={18} />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">Redis Buckets</div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Per-tenant sliding-window limits protect API and webhook workers (60 webhook/min, 120 API/min) returning HTTP 429 with <code>Retry-After</code> headers.
          </p>
        </div>
      </div>

      {/* Role-Based Permissions Matrix */}
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <UserCheck size={18} className="text-indigo-600" />
          <span>Role-Based Access Control (RBAC) Governance Matrix</span>
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {ROLES_INFO.map((r) => (
            <div key={r.role} className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">{r.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border uppercase ${r.badge}`}>
                  {r.role}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Organization Members Table */}
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm space-y-0">
        <div className="border-b bg-slate-50 px-5 py-3.5 font-bold text-sm text-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-indigo-600" />
            <span>Organization Members & Assigned Roles ({members.length})</span>
          </div>
          <span className="text-xs font-normal text-slate-500">Installation ID #500 (acme)</span>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">
            <tr>
              {["User Login", "Assigned RBAC Role", "Tenant Scope", "Permission Level"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => {
              const info = ROLES_INFO.find((r) => r.role === m.role) || ROLES_INFO[2];
              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">{m.github_login}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border uppercase ${info.badge}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">Installation #{m.installation_id}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{info.title}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pre-LLM Secret Redaction Showcase */}
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <KeyRound size={18} className="text-indigo-600" />
          <span>Pre-LLM Secret Stripping & Zero-Trust Sanitation</span>
        </h2>
        <p className="text-xs text-slate-600">
          Before any diff is serialized into prompt payloads, high-entropy secrets are automatically masked to ensure credentials never leave the tenant boundary.
        </p>
        <div className="grid gap-3 md:grid-cols-2 text-xs font-mono">
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3.5 space-y-1">
            <span className="font-bold text-rose-800 text-[11px] uppercase tracking-wider">Raw Input Code Diff (Unsanitized):</span>
            <pre className="text-rose-900 overflow-x-auto whitespace-pre-wrap">
              {`AWS_SECRET_KEY = "AKIAIOSFODNN7EXAMPLE"\nOPENAI_KEY = "sk-live-93821938210382103821"`}
            </pre>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-1">
            <span className="font-bold text-emerald-800 text-[11px] uppercase tracking-wider">Payload Sent to Model (Redacted):</span>
            <pre className="text-emerald-900 overflow-x-auto whitespace-pre-wrap">
              {`AWS_SECRET_KEY = "[REDACTED_AWS_ACCESS_KEY]"\nOPENAI_KEY = "[REDACTED_OPENAI_API_KEY]"`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

