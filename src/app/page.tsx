"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type DashboardStats = {
  totalHosts: number;
  online: number;
  offline: number;
  unstable: number;
  unknown: number;
};

const initialStats: DashboardStats = {
  totalHosts: 0,
  online: 0,
  offline: 0,
  unstable: 0,
  unknown: 0,
};

type StatusFilter = "ALL" | "ONLINE" | "OFFLINE" | "UNSTABLE" | "UNKNOWN";

type HostItem = {
  id: number;
  siteName: string;
  hostName: string;
  ipAddress: string | null;
  status: string | null;
  wan1Status: string | null;
  wan2Status: string | null;
  lastSeenAt: string | null;
};

export default function HomePage() {
  const searchParams = useSearchParams();
  const tvMode = searchParams.get("tv") === "1";

  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loadingStats, setLoadingStats] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<StatusFilter>("ALL");
  const [statsError, setStatsError] = useState<string | null>(null);

  const [hosts, setHosts] = useState<HostItem[]>([]);
  const [loadingHosts, setLoadingHosts] = useState(true);
  const [hostsError, setHostsError] = useState<string | null>(null);

  // tick que o TV mode usa para auto-refresh
  const [refreshToken, setRefreshToken] = useState(0);

  // Auto-refresh a cada 30s somente em TV Mode
  useEffect(() => {
    if (!tvMode) return;

    const id = setInterval(() => {
      setRefreshToken((t) => t + 1);
    }, 30_000);

    return () => clearInterval(id);
  }, [tvMode]);

  // Carrega as estatísticas gerais
  useEffect(() => {
    async function loadStats() {
      try {
        setLoadingStats(true);
        const res = await fetch("/api/dashboard/stats");
        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status}`);
        }
        const data = (await res.json()) as DashboardStats;
        setStats(data);
        setStatsError(null);
      } catch (err) {
        console.error(err);
        setStatsError("Falha ao carregar estatísticas do dashboard.");
      } finally {
        setLoadingStats(false);
      }
    }

    loadStats();
  }, [refreshToken]);

  // Carrega a lista de hosts principais conforme o filtro
  useEffect(() => {
    async function loadHosts() {
      try {
        setLoadingHosts(true);
        const param =
          selectedFilter === "ALL" ? "ALL" : encodeURIComponent(selectedFilter);
        const res = await fetch(`/api/hosts?status=${param}`);
        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status}`);
        }
        const data = (await res.json()) as HostItem[];
        setHosts(data);
        setHostsError(null);
      } catch (err) {
        console.error(err);
        setHostsError("Falha ao carregar a lista de hosts.");
      } finally {
        setLoadingHosts(false);
      }
    }

    loadHosts();
  }, [selectedFilter, refreshToken]);

  const cards = [
    {
      key: "ONLINE" as StatusFilter,
      label: "Online",
      value: stats.online,
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/40",
      text: "text-emerald-300",
    },
    {
      key: "UNSTABLE" as StatusFilter,
      label: "Unstable",
      value: stats.unstable,
      bg: "bg-amber-500/10",
      border: "border-amber-500/40",
      text: "text-amber-300",
    },
    {
      key: "OFFLINE" as StatusFilter,
      label: "Offline",
      value: stats.offline,
      bg: "bg-rose-500/10",
      border: "border-rose-500/40",
      text: "text-rose-300",
    },
    {
      key: "UNKNOWN" as StatusFilter,
      label: "Unknown",
      value: stats.unknown,
      bg: "bg-slate-500/10",
      border: "border-slate-500/40",
      text: "text-slate-300",
    },
  ];

  function formatStatus(status: string | null) {
    if (!status) return "UNKNOWN";
    return status.toUpperCase();
  }

  function statusBadgeClasses(status: string | null) {
    const s = status?.toUpperCase();
    if (s === "ONLINE") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";
    if (s === "OFFLINE") return "bg-rose-500/10 text-rose-300 border-rose-500/40";
    if (s === "UNSTABLE") return "bg-amber-500/10 text-amber-300 border-amber-500/40";
    return "bg-slate-500/10 text-slate-300 border-slate-500/40";
  }

  return (
    <div className="space-y-6">
      {!tvMode && (
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Overall Status (Hosts)
          </h1>
          <p className="text-sm text-slate-400">
            {loadingStats
              ? "Carregando estatísticas..."
              : `Monitorando ${stats.totalHosts} hosts principais.`}
          </p>
        </div>
      )}

      {tvMode && (
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Overall Status (Hosts)
          </h1>
          <p className="text-xs text-slate-500">
            Atualizando automaticamente (TV mode)
          </p>
        </div>
      )}

      {statsError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {statsError}
        </div>
      )}

      {/* Cards de status */}
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => {
          const isActive = selectedFilter === card.key;
          return (
            <button
              key={card.key}
              onClick={() =>
                setSelectedFilter((prev) =>
                  prev === card.key ? "ALL" : card.key,
                )
              }
              className={[
                "flex flex-col items-start rounded-xl border px-4 py-4 text-left transition",
                card.bg,
                card.border,
                isActive
                  ? "ring-2 ring-offset-2 ring-indigo-500 ring-offset-slate-950"
                  : "hover:border-indigo-500/40 hover:bg-slate-900/40",
              ].join(" ")}
            >
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {card.label}
              </span>
              <span
                className={`mt-2 ${
                  tvMode ? "text-4xl" : "text-2xl"
                } font-semibold ${card.text}`}
              >
                {loadingStats ? "…" : card.value}
              </span>
              {!tvMode && (
                <span className="mt-1 text-[11px] text-slate-500">
                  Clique para filtrar hosts por status
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista de hosts principais */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Sites (hosts principais)
            </h2>
            {!tvMode && (
              <p className="text-xs text-slate-400">
                Lista baseada no filtro selecionado nos cards acima.
              </p>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Filtro atual:{" "}
            <span className="font-semibold text-indigo-300">
              {selectedFilter === "ALL" ? "TODOS" : selectedFilter}
            </span>
          </p>
        </div>

        {hostsError && (
          <div className="mb-2 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {hostsError}
          </div>
        )}

        {loadingHosts ? (
          <p className="text-xs text-slate-500">Carregando hosts…</p>
        ) : hosts.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhum host encontrado para este filtro.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {hosts.map((host) => (
              <div
                key={host.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {host.siteName}
                    </p>
                    <p className="text-sm font-semibold text-slate-100">
                      {host.hostName}
                    </p>
                    {host.ipAddress && (
                      <p className="text-[11px] text-slate-500">
                        IP: {host.ipAddress}
                      </p>
                    )}
                  </div>
                  <span
                    className={
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                      statusBadgeClasses(host.status)
                    }
                  >
                    {formatStatus(host.status)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5">
                    <span className="text-[9px] text-slate-500">WAN 1</span>
                    <span className="font-semibold">
                      {formatStatus(host.wan1Status)}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5">
                    <span className="text-[9px] text-slate-500">WAN 2</span>
                    <span className="font-semibold">
                      {formatStatus(host.wan2Status)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}