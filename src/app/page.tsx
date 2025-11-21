"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "ONLINE" | "UNSTABLE" | "OFFLINE" | "UNKNOWN";

type DashboardStats = {
  totalHosts: number;
  onlineHosts: number;
  unstableHosts: number;
  offlineHosts: number;
  unknownHosts: number;
};

type HostItem = {
  id: number;
  siteName: string;
  hostName: string;
  ipAddress: string | null;
  status: Status | null;
  wan1Status: Status | null;
  wan2Status: Status | null;
  lastSeenAt: string | null;
};

function formatStatusLabel(status: Status | null | undefined) {
  switch (status) {
    case "ONLINE":
      return "ONLINE";
    case "UNSTABLE":
      return "UNSTABLE";
    case "OFFLINE":
      return "OFFLINE";
    case "UNKNOWN":
    default:
      return "UNKNOWN";
  }
}

function statusBadgeClasses(status: Status | null | undefined) {
  switch (status) {
    case "ONLINE":
      return "border-emerald-500/60 bg-emerald-900/40 text-emerald-300";
    case "UNSTABLE":
      return "border-amber-500/60 bg-amber-900/40 text-amber-300";
    case "OFFLINE":
      return "border-rose-500/60 bg-rose-900/40 text-rose-300";
    case "UNKNOWN":
    default:
      return "border-slate-500/60 bg-slate-900/60 text-slate-300";
  }
}

function DashboardPageInner() {
  const searchParams = useSearchParams();
  const isTvMode = searchParams.get("tv") === "1";

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hosts, setHosts] = useState<HostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("ALL");

  async function loadData() {
    try {
      setLoading(true);

      const [statsRes, hostsRes] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch("/api/hosts"),
      ]);

      if (!statsRes.ok || !hostsRes.ok) {
        throw new Error("Erro ao carregar dados do dashboard");
      }

      const statsData = (await statsRes.json()) as DashboardStats;
      const hostsData = (await hostsRes.json()) as HostItem[];

      setStats(statsData);
      setHosts(hostsData);
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // TV mode: auto-refresh a cada 30s
  useEffect(() => {
    if (!isTvMode) return;
    const id = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(id);
  }, [isTvMode]);

  const filteredHosts = hosts.filter((h) => {
    if (statusFilter === "ALL") return true;
    return (h.status ?? "UNKNOWN") === statusFilter;
  });

  const currentFilterLabel =
    statusFilter === "ALL" ? "TODOS" : formatStatusLabel(statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-50">
          Overall Status (Hosts)
        </h1>
        <p className="text-sm text-slate-400">
          Monitorando {stats?.totalHosts ?? 0} hosts principais.
          {isTvMode && " • Atualizando automaticamente (TV mode)"}
        </p>
      </div>

      {/* Cards de status */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            key: "ONLINE",
            label: "ONLINE",
            value: stats?.onlineHosts ?? 0,
            border: "border-emerald-500/70",
            bg: "bg-emerald-900/40",
          },
          {
            key: "UNSTABLE",
            label: "UNSTABLE",
            value: stats?.unstableHosts ?? 0,
            border: "border-amber-500/70",
            bg: "bg-amber-900/40",
          },
          {
            key: "OFFLINE",
            label: "OFFLINE",
            value: stats?.offlineHosts ?? 0,
            border: "border-rose-500/70",
            bg: "bg-rose-900/40",
          },
          {
            key: "UNKNOWN",
            label: "UNKNOWN",
            value: stats?.unknownHosts ?? 0,
            border: "border-slate-500/70",
            bg: "bg-slate-900/40",
          },
        ].map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() =>
              setStatusFilter(card.key as Status | "ALL")
            }
            className={`flex flex-col justify-between rounded-2xl border px-4 py-4 text-left shadow-sm transition hover:shadow-md ${card.border} ${card.bg}`}
          >
            <div className="text-xs font-semibold text-slate-300">
              {card.label}
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-slate-50">
              {card.value}
            </div>
            <div className="mt-1 text-[11px] text-slate-300">
              Clique para filtrar hosts por status
            </div>
          </button>
        ))}
      </div>

      {/* Lista de hosts */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Sites (hosts principais)
            </div>
            <div className="text-xs text-slate-400">
              Lista baseada no filtro selecionado nos cards acima.
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Filtro atual:{" "}
            <span className="font-semibold text-slate-100">
              {currentFilterLabel}
            </span>
          </div>
        </div>

        {loading && (
          <div className="px-4 py-4 text-sm text-slate-400">
            Carregando hosts...
          </div>
        )}

        {!loading && filteredHosts.length === 0 && (
          <div className="px-4 py-4 text-sm text-slate-400">
            Nenhum host encontrado para o filtro atual.
          </div>
        )}

        <div className="divide-y divide-slate-800">
          {filteredHosts.map((host) => (
            <div
              key={host.id}
              className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-400">
                  {host.siteName}
                </div>
                <div className="text-sm font-semibold text-slate-50">
                  {host.hostName}
                </div>
                <div className="text-xs text-slate-400">
                  IP: {host.ipAddress ?? "N/A"}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className={
                    "rounded-full px-2 py-1 font-semibold " +
                    statusBadgeClasses(host.status)
                  }
                >
                  {formatStatusLabel(host.status)}
                </span>

                <span
                  className={
                    "rounded-full px-2 py-1 " +
                    statusBadgeClasses(host.wan1Status)
                  }
                >
                  WAN 1 {formatStatusLabel(host.wan1Status)}
                </span>
                <span
                  className={
                    "rounded-full px-2 py-1 " +
                    statusBadgeClasses(host.wan2Status)
                  }
                >
                  WAN 2 {formatStatusLabel(host.wan2Status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="py-6 text-sm text-slate-400">
          Carregando dashboard...
        </div>
      }
    >
      <DashboardPageInner />
    </Suspense>
  );
}