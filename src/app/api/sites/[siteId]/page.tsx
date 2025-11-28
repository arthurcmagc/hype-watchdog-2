// src/app/sites/[siteId]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { SiteStatusSummary } from "@/lib/siteStatus";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Snapshot = {
  id: number;
  siteId: string;
  siteName: string;
  overallStatus: string;
  totalDevices: number | null;
  offlineDevices: number | null;
  createdAt: string;
};

type HistoryResponse = {
  ok: boolean;
  snapshots: Snapshot[];
  events: {
    id: string;
    siteId: string;
    siteName: string;
    severity: string;
    title: string;
    message: string | null;
    createdAt: string;
  }[];
};

type SitesApiResponse = {
  ok: boolean;
  stats: {
    totalSites: number;
    online: number;
    unstable: number;
    offline: number;
    unknown: number;
    operational: number;
  };
  sites: SiteStatusSummary[];
};

function statusToNumber(status: string): number {
  switch (status) {
    case "offline":
      return 0;
    case "unstable":
      return 1;
    case "online":
      return 2;
    default:
      return 1; // unknown ~ meio termo
  }
}

function statusToLabelPt(status: string): string {
  switch (status) {
    case "offline":
      return "OFFLINE";
    case "unstable":
      return "INSTÁVEL";
    case "online":
      return "ONLINE";
    default:
      return "DESCONHECIDO";
  }
}

export default function SiteDetailPage() {
  const params = useParams<{ siteId: string }>();
  const searchParams = useSearchParams();
  const tvMode = searchParams.get("tv") === "1";

  const [currentSite, setCurrentSite] = useState<SiteStatusSummary | null>(
    null
  );
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const siteId = decodeURIComponent(params.siteId);

  // Carrega status atual + histórico
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setLoadingError(null);

        // 1) Puxa todos os sites e filtra o atual
        const sitesRes = await fetch("/api/unifi-cloud/sites");
        if (!sitesRes.ok) {
          throw new Error(`Erro HTTP sites ${sitesRes.status}`);
        }
        const sitesData = (await sitesRes.json()) as SitesApiResponse;
        if (!sitesData.ok) {
          throw new Error("Backend de sites retornou ok=false");
        }

        const site =
          sitesData.sites.find(
            (s) => s.siteId === siteId || s.hostId === siteId
          ) ??
          sitesData.sites.find((s) => s.siteName === siteId) ??
          null;

        setCurrentSite(site);

        // 2) Histórico desse site
        const historyRes = await fetch(
          `/api/sites/${encodeURIComponent(siteId)}/history?hours=24`
        );
        if (!historyRes.ok) {
          throw new Error(`Erro HTTP history ${historyRes.status}`);
        }
        const historyData = (await historyRes.json()) as HistoryResponse;
        if (!historyData.ok) {
          throw new Error("Backend de histórico retornou ok=false");
        }
        setHistory(historyData);
      } catch (err: any) {
        console.error("[SiteDetailPage] erro ao carregar:", err);
        setLoadingError(
          err?.message ?? "Não foi possível carregar o dashboard do site."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [siteId]);

  const chartData = useMemo(() => {
    if (!history?.snapshots) return [];

    return history.snapshots.map((snap) => ({
      time: new Date(snap.createdAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      statusNum: statusToNumber(snap.overallStatus),
      statusLabel: statusToLabelPt(snap.overallStatus),
      offlineDevices: snap.offlineDevices ?? 0,
      totalDevices: snap.totalDevices ?? 0,
    }));
  }, [history?.snapshots]);

  const siteName =
    currentSite?.siteName ??
    history?.snapshots?.[0]?.siteName ??
    siteId ??
    "Site";

  const currentStatus = currentSite?.overallStatus ?? "unknown";
  const currentStatusLabel = statusToLabelPt(currentStatus);

  const deviceStats = currentSite?.deviceStats ?? {
    total: 0,
    online: 0,
    offline: 0,
    unstable: 0,
  };

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-50 ${
        tvMode ? "overflow-hidden" : ""
      }`}
    >
      <main className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4">
        {/* HEADER */}
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Link
                href="/"
                className="text-slate-400 hover:text-emerald-300 transition-colors"
              >
                ← Voltar para visão geral
              </Link>
              <span className="text-slate-600">/</span>
              <span>Dashboard do site</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight">
              {siteName}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Histórico de status, devices e eventos (últimas 24h).
            </p>
          </div>

          <div className="text-right text-xs text-slate-400 space-y-[2px]">
            <div className="inline-flex items-center gap-2">
              <span
                className={
                  currentStatus === "online"
                    ? "px-3 py-[3px] rounded-full text-[11px] font-semibold border bg-emerald-500/15 border-emerald-500 text-emerald-200"
                    : currentStatus === "offline"
                    ? "px-3 py-[3px] rounded-full text-[11px] font-semibold border bg-red-500/15 border-red-500 text-red-200"
                    : currentStatus === "unstable"
                    ? "px-3 py-[3px] rounded-full text-[11px] font-semibold border bg-amber-500/15 border-amber-400 text-amber-200"
                    : "px-3 py-[3px] rounded-full text-[11px] font-semibold border bg-slate-700/40 border-slate-500 text-slate-200"
                }
              >
                {currentStatusLabel}
              </span>

              {currentStatus === "unstable" && (
                <span className="px-2 py-[2px] rounded-full text-[10px] font-semibold border border-emerald-500/60 text-emerald-200 bg-emerald-500/10">
                  ONLINE (com instabilidade)
                </span>
              )}
            </div>

            <div className="text-[10px] text-slate-500">
              Dev:{" "}
              <span className="text-emerald-300">
                {deviceStats.online}/{deviceStats.total}
              </span>{" "}
              · Off:{" "}
              <span className="text-red-400">{deviceStats.offline}</span>
            </div>
          </div>
        </header>

        {loading && (
          <div className="text-xs text-slate-400">Carregando dados...</div>
        )}

        {loadingError && (
          <div className="text-xs text-red-400">{loadingError}</div>
        )}

        {!loading && !loadingError && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Gráfico de status */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Histórico de status
                </h2>
                <span className="text-[10px] text-slate-500">
                  Últimas 24 horas
                </span>
              </div>

              {chartData.length === 0 ? (
                <div className="text-[11px] text-slate-500">
                  Ainda não há snapshots suficientes para exibir.
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                      />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        ticks={[0, 1, 2]}
                        domain={[0, 2]}
                        tickFormatter={(v: number) =>
                        v === 0 ? "OFF" : v === 1 ? "UNST" : "ON"
                      }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#020617",
                          borderRadius: 8,
                          border: "1px solid #1f2937",
                          fontSize: 11,
                              }}
                          formatter={(
                          value: number | string,
                          name: string,
                          props: any
                        ) => {
                      if (name === "statusNum") {
                    return [
                    statusToLabelPt(
                    props.payload?.statusLabel ?? ""
                  ),
                "Status",
              ];
            }
          if (name === "offlineDevices") {
          return [value, "Devices offline"];
          }
          return [value, name];
        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="statusNum"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Gráfico de devices offline */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Devices offline
                </h2>
                <span className="text-[10px] text-slate-500">
                  Últimas 24 horas
                </span>
              </div>

              {chartData.length === 0 ? (
                <div className="text-[11px] text-slate-500">
                  Ainda não há snapshots suficientes para exibir.
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                      />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#020617",
                          borderRadius: 8,
                          border: "1px solid #1f2937",
                          fontSize: 11,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="offlineDevices"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Lista de eventos do site */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 lg:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Eventos do site
                </h2>
                <span className="text-[10px] text-slate-500">
                  Últimos {history?.events?.length ?? 0} registros
                </span>
              </div>

              {history?.events?.length ? (
                <div className="space-y-2 text-xs">
                  {history.events.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-2 border-b border-slate-800/70 pb-1 last:border-0 last:pb-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={severityBadgeClasses(ev.severity)}>
                            {ev.severity}
                          </span>
                          <span className="truncate max-w-[180px]">
                            {ev.title}
                          </span>
                        </div>
                        {ev.message && (
                          <div className="text-[10px] text-slate-500 line-clamp-2">
                            {ev.message}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-[10px] text-slate-500 whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">
                  Nenhum evento recente para este site.
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function severityBadgeClasses(severity: string): string {
  const base =
    "inline-flex items-center justify-center px-2 py-[1px] rounded-full text-[10px] font-semibold border";

  const sev = severity.toUpperCase();
  if (sev === "CRITICAL") {
    return `${base} bg-red-500/15 border-red-500 text-red-200`;
  }
  if (sev === "WARNING") {
    return `${base} bg-amber-500/15 border-amber-400 text-amber-200`;
  }
  if (sev === "INFO") {
    return `${base} bg-sky-500/15 border-sky-400 text-sky-200`;
  }
  return `${base} bg-slate-700/40 border-slate-500 text-slate-200`;
}