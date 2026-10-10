import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AuditItem,
  ComplianceReport,
  EvalQualityRun,
  EvalRun,
  GovernanceOverview,
  Overview,
  Repo,
  RepoSettings,
  Review,
  ReviewDetail,
} from "../types";

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${url}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const useOverview = () =>
  useQuery({ queryKey: ["overview"], queryFn: () => http<Overview>("/analytics/overview"), refetchInterval: 15000 });

export const useReviews = (repo?: string) =>
  useQuery({
    queryKey: ["reviews", repo],
    queryFn: () => http<Review[]>(`/reviews${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`),
    refetchInterval: 15000,
  });

export const useReview = (id: string | null | undefined) =>
  useQuery({
    queryKey: ["review", id],
    queryFn: () => http<ReviewDetail>(`/reviews/${id}`),
    enabled: Boolean(id && typeof id === "string" && id.trim().length > 0),
  });

export const useRepos = () => useQuery({ queryKey: ["repos"], queryFn: () => http<Repo[]>("/repos") });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, settings }: { id: number; settings: RepoSettings }) =>
      http<RepoSettings>(`/repos/${id}/settings`, { method: "PUT", body: JSON.stringify(settings) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });
}

export const useEvalLatest = () =>
  useQuery({ queryKey: ["evals", "latest"], queryFn: () => http<EvalRun[]>("/evals/latest") });

export const useEvalQuality = () =>
  useQuery({ queryKey: ["evals", "quality"], queryFn: () => http<EvalQualityRun[]>("/evals/quality") });

export const useComplianceReport = () =>
  useQuery({ queryKey: ["compliance", "report"], queryFn: () => http<ComplianceReport>("/compliance/report") });

export const useGovernanceOverview = () =>
  useQuery({ queryKey: ["governance", "overview"], queryFn: () => http<GovernanceOverview>("/governance/overview") });

export const useAuditLogs = () =>
  useQuery({ queryKey: ["audit", "logs"], queryFn: () => http<AuditItem[]>("/audit?limit=100") });

export const useVerifyAudit = () =>
  useQuery({ queryKey: ["audit", "verify"], queryFn: () => http<import("../types").VerifyChainResult>("/audit/verify") });

export function useCreateCheckpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: "demo" | "live" = "demo") =>
      http<import("../types").CheckpointResult>("/audit/checkpoint", {
        method: "POST",
        body: JSON.stringify({ mode }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export const useMembers = () =>
  useQuery({ queryKey: ["orgs", "members"], queryFn: () => http<import("../types").Member[]>("/orgs/members") });

export function usePauseRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paused }: { id: number; paused: boolean }) =>
      http<{ status: string; paused: boolean; repo: string }>(`/repos/${id}/pause`, {
        method: "POST",
        body: JSON.stringify({ paused }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (id: number) =>
      http<{
        status: string;
        repository: string;
        installation_id: number;
        github_app: { app_name: string; authenticated: boolean; permissions: Record<string, string> };
        webhook: { endpoint: string; secret_configured: boolean; signature_algorithm: string; last_delivery_status: string };
        checks_api: { check_name: string; write_access: boolean; branch_protection_detected: boolean };
        latency_ms: number;
      }>(`/repos/${id}/test-connection`, { method: "POST" }),
  });
}

export function useDisconnectRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http<{ status: string; repo: string }>(`/repos/${id}/disconnect`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });
}

export const useRepoActivity = (repoId: number | null) =>
  useQuery({
    queryKey: ["repo", "activity", repoId],
    queryFn: () => http<AuditItem[]>(`/repos/${repoId}/activity`),
    enabled: repoId !== null,
  });

export const usePipelineActivity = () =>
  useQuery({
    queryKey: ["repos", "pipeline-activity"],
    queryFn: () => http<any[]>("/repos/pipeline-activity"),
  });

export function useRetryReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) =>
      http<{ status: string; review_id: string; new_status: string }>(`/reviews/${reviewId}/retry`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useBulkRetryReviews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewIds: string[]) =>
      http<{ status: string; retried: number }>("/reviews/bulk-retry", {
        method: "POST",
        body: JSON.stringify({ review_ids: reviewIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useRequestException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, reason, durationHours, policyScope }: { reviewId: string; reason: string; durationHours: number; policyScope?: string }) =>
      http<{ status: string; review_id: string; exception: import("../types").ExceptionDetail }>(`/reviews/${reviewId}/request-exception`, {
        method: "POST",
        body: JSON.stringify({ reason, duration_hours: durationHours, policy_scope: policyScope || "all_blocking_findings" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["review"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useApproveException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, notes, overrideHours }: { reviewId: string; notes?: string; overrideHours?: number }) =>
      http<{ status: string; review_id: string; exception: import("../types").ExceptionDetail }>(`/reviews/${reviewId}/approve-exception`, {
        method: "POST",
        body: JSON.stringify({ notes, override_hours: overrideHours }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["review"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useRejectException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, notes }: { reviewId: string; notes?: string }) =>
      http<{ status: string; review_id: string; exception: import("../types").ExceptionDetail }>(`/reviews/${reviewId}/reject-exception`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["review"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useSuppressFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId, reason, notes }: { findingId: string; reason: string; notes?: string }) =>
      http<{ status: string; finding_id: string; suppression: any; merge_blocked: boolean }>(`/reviews/findings/${findingId}/suppress`, {
        method: "POST",
        body: JSON.stringify({ reason, notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["review"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useCompareReview(reviewId: string) {
  return useQuery({
    queryKey: ["review-compare", reviewId],
    queryFn: () => http<any>(`/reviews/${reviewId}/compare`),
    enabled: Boolean(reviewId && reviewId.trim().length > 0),
  });
}

