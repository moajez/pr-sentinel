import { DollarSign, Cpu, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { useGovernanceOverview } from "../../api/client";
import { PageState } from "../Layout/Layout";

export default function Governance() {
  const { data, isLoading, error } = useGovernanceOverview();

  if (!data) return <PageState loading={isLoading} error={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cost Governance & Model Routing</h1>
        <p className="mt-1 text-sm text-slate-600">
          Budget limits, team cost allocations, forecast, and dynamic AI model routing (Tier-1 vs Tier-2).
        </p>
      </div>

      {/* Highlights */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs uppercase font-medium text-slate-500">
            <span>Month-to-Date Spend</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">${data.month_spent_usd.toFixed(4)}</div>
          <div className="mt-1 text-xs text-slate-500">Live aggregated token charges</div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs uppercase font-medium text-slate-500">
            <span>Forecasted Spend</span>
            <TrendingUp size={16} className="text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">${data.month_forecast_usd.toFixed(4)}</div>
          <div className="mt-1 text-xs text-slate-500">Projected month-end billing</div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs uppercase font-medium text-slate-500">
            <span>Budget Ceiling</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {data.budget?.limit ? `$${data.budget.limit.toFixed(2)}` : "Unrestricted"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {data.budget ? `${data.budget.pct}% consumed` : "No ceiling configured"}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs uppercase font-medium text-slate-500">
            <span>Enforcement Mode</span>
            <Cpu size={16} className="text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {data.budget?.enforce ? "Active Gate" : "Advisory"}
          </div>
          <div className="mt-1 text-xs text-slate-500">Auto-skip reviews on limit</div>
        </div>
      </div>

      {/* Model Routing Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Cpu size={18} className="text-indigo-600" /> Dynamic Model Routing
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Model Tier", "Reviews", "Cost USD", "Avg Latency"].map((h) => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.by_model.map((m) => (
                <tr key={m.model} className="border-t">
                  <td className="px-3 py-2 font-mono font-medium text-slate-800">{m.model}</td>
                  <td className="px-3 py-2">{m.reviews}</td>
                  <td className="px-3 py-2 font-mono">${m.cost_usd.toFixed(4)}</td>
                  <td className="px-3 py-2">{m.avg_latency_ms.toFixed(0)} ms</td>
                </tr>
              ))}
              {data.by_model.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    No review routing history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Users size={18} className="text-emerald-600" /> Team Cost Allocations
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Team", "Reviews", "Cost USD"].map((h) => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.by_team.map((t) => (
                <tr key={t.team} className="border-t">
                  <td className="px-3 py-2 font-medium text-slate-800">{t.team}</td>
                  <td className="px-3 py-2">{t.reviews}</td>
                  <td className="px-3 py-2 font-mono">${t.cost_usd.toFixed(4)}</td>
                </tr>
              ))}
              {data.by_team.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                    No team allocations configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

