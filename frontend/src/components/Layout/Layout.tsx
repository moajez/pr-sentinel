import {
  LayoutDashboard,
  GitPullRequest,
  Settings as Cog,
  ShieldAlert,
  ShieldCheck,
  FileCheck2,
  DollarSign,
  History,
  GitBranch,
  Users,
  Cpu,
  CheckSquare,
  Bot
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import type { Severity } from "../../types";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/reviews", label: "Reviews Explorer", icon: GitPullRequest },
  { to: "/cicd", label: "GitHub App & CI/CD", icon: GitBranch },
  { to: "/identity", label: "Enterprise Security & RBAC", icon: Users },
  { to: "/remediation", label: "Safe Remediation Sandbox", icon: Cpu },
  { to: "/compliance", label: "Compliance Gate", icon: FileCheck2 },
  { to: "/governance", label: "Cost Governance", icon: DollarSign },
  { to: "/evals", label: "AI Reliability & Evals", icon: ShieldAlert },
  { to: "/audit", label: "Audit Ledger", icon: History },
  { to: "/guide", label: "Product Guide", icon: CheckSquare },
  { to: "/settings", label: "Rules & Policy", icon: Cog },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r bg-white p-4 flex flex-col justify-between">
        <div>
          <div className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-900 px-2">
            <ShieldCheck className="text-indigo-600" size={24} /> PR Sentinel
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">
            Enterprise Security
          </div>
          <nav className="space-y-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-indigo-50 font-medium text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon size={17} /> {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sentinel Assistant Help Card */}
        <div className="pt-6">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Bot size={16} />
              </div>
              <div className="leading-tight">
                <div className="text-xs font-bold text-slate-900">Need help?</div>
                <div className="text-[10px] text-slate-500">Ask Sentinel anything</div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Explore the product guide or ask our AI assistant questions.
            </p>
            <Link
              to="/guide"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-0.5"
            >
              <span>Chat with Sentinel</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#7f1d1d",
  high: "#dc2626",
  medium: "#f97316",
  low: "#eab308",
  info: "#64748b",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className="rounded px-2 py-0.5 text-xs font-semibold uppercase text-white shadow-sm"
      style={{ background: SEVERITY_COLORS[severity] }}
    >
      {severity}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  processing: "bg-blue-100 text-blue-700",
  pending: "bg-slate-100 text-slate-600",
  skipped: "bg-amber-100 text-amber-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? ""}`}>{status}</span>;
}

export function PageState({ loading, error }: { loading: boolean; error: unknown }) {
  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-red-600">Failed to load data. Is the backend running?</p>;
  return null;
}
