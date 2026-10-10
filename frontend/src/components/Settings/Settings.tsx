import { useEffect, useState } from "react";
import { useRepos, useSaveSettings } from "../../api/client";
import type { RepoSettings, Severity } from "../../types";
import { PageState } from "../Layout/Layout";

const SEVERITIES: Severity[] = ["info", "low", "medium", "high", "critical"];
const EMPTY: RepoSettings = { min_severity: "info", exclude_paths: [], rules: [] };

export default function Settings() {
  const { data: repos, isLoading, error } = useRepos();
  const save = useSaveSettings();
  const [repoId, setRepoId] = useState<number | null>(null);
  const [form, setForm] = useState<RepoSettings>(EMPTY);
  const [paths, setPaths] = useState("");

  useEffect(() => {
    if (repos?.length && repoId === null) setRepoId(repos[0].id);
  }, [repos, repoId]);

  useEffect(() => {
    const repo = repos?.find((r) => r.id === repoId);
    if (repo) {
      setForm(repo.settings);
      setPaths(repo.settings.exclude_paths.join("\n"));
    }
  }, [repoId, repos]);

  if (!repos) return <PageState loading={isLoading} error={error} />;
  if (repos.length === 0)
    return <p className="text-slate-500">No repositories yet. They appear after the first PR review.</p>;

  const submit = () =>
    save.mutate({
      id: repoId!,
      settings: { ...form, exclude_paths: paths.split("\n").map((p) => p.trim()).filter(Boolean) },
    });

  const setRule = (i: number, patch: Partial<RepoSettings["rules"][number]>) =>
    setForm({ ...form, rules: form.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Rule Editor</h1>

      <label className="block text-sm font-medium">
        Repository
        <select className="mt-1 block w-full rounded border p-2" value={repoId ?? ""} onChange={(e) => setRepoId(Number(e.target.value))}>
          {repos.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Minimum severity to report
        <select className="mt-1 block w-full rounded border p-2" value={form.min_severity}
          onChange={(e) => setForm({ ...form, min_severity: e.target.value as Severity })}>
          {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Excluded paths (one glob per line)
        <textarea className="mt-1 block h-28 w-full rounded border p-2 font-mono text-sm" value={paths}
          placeholder={"dist/**\nnode_modules/**\n*.min.js"} onChange={(e) => setPaths(e.target.value)} />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Custom rules</span>
          <button className="text-sm text-indigo-700"
            onClick={() => setForm({ ...form, rules: [...form.rules, { name: "", enabled: true, severity: "medium" }] })}>
            + Add rule
          </button>
        </div>
        {form.rules.map((r, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <input type="checkbox" checked={r.enabled} onChange={(e) => setRule(i, { enabled: e.target.checked })} />
            <input className="flex-1 rounded border p-2 text-sm" value={r.name} placeholder="e.g. enforce-sql-parameterization"
              onChange={(e) => setRule(i, { name: e.target.value })} />
            <select className="rounded border p-2 text-sm" value={r.severity} onChange={(e) => setRule(i, { severity: e.target.value as Severity })}>
              {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button className="text-red-600" onClick={() => setForm({ ...form, rules: form.rules.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={save.isPending} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          {save.isPending ? "Saving…" : "Save"}
        </button>
        {save.isSuccess && <span className="text-sm text-green-600">Saved</span>}
        {save.isError && <span className="text-sm text-red-600">Save failed</span>}
      </div>
    </div>
  );
}

