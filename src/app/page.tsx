"use client";

import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SiteStatusSummary } from "@/lib/siteStatus";

// --------- TIPOS --------- //

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

type EventRecord = {
  id: string;
  siteId: string | null;
  siteName: string;
  severity: string;
  title: string;
  message: string | null;
  createdAt: string;
  isPrimaryHost?: boolean;
};

type EventsApiResponse = {
  ok: boolean;
  events: EventRecord[];
};

// --------- COMPONENTE WRAPPER COM SUSPENSE --------- //

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardPage />
    </Suspense>
  );
}

// --------- DASHBOARD PRINCIPAL (CLIENT) --------- //

type FilterKind = "all" | "online" | "unstable" | "offline";

function DashboardPage() {
  const searchParams = useSearchParams();
  const tvMode = searchParams.get("tv") === "1";

  const [sites, setSites] = useState<SiteStatusSummary[]>([]);
  const [sitesStats, setSitesStats] = useState<SitesApiResponse["stats"] | null>(
    null
  );
  const [sitesLoading, setSitesLoading] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [filter, setFilter] = useState<FilterKind>("all");

  const tvScrollRef = useRef<HTMLDivElement | null>(null);
  const eventsRef = useRef<HTMLDivElement | null>(null);

  // --------- CARREGAMENTO SITES + EVENTOS --------- //

  useEffect(() => {
    let cancelled = false;

    async function loadSitesAndEvents() {
      try {
        setSitesLoading(true);
        setSitesError(null);

        const [sitesRes, eventsRes] = await Promise.all([
          fetch("/api/unifi-cloud/sites"),
          fetch("/api/events"),
        ]);

        if (!sitesRes.ok) {
          throw new Error(`Erro HTTP sites ${sitesRes.status}`);
        }
        const sitesJson = (await sitesRes.json()) as SitesApiResponse;
        if (!sitesJson.ok) {
          throw new Error("Backend /api/unifi-cloud/sites retornou ok=false");
        }

        if (!eventsRes.ok) {
          throw new Error(`Erro HTTP events ${eventsRes.status}`);
        }
        const eventsJson = (await eventsRes.json()) as EventsApiResponse;

        if (!cancelled) {
          setSites(sitesJson.sites ?? []);
          setSitesStats(sitesJson.stats ?? null);
          setEvents(eventsJson.ok ? eventsJson.events ?? [] : []);
        }
      } catch (err: any) {
        console.error("[DashboardPage] erro ao carregar sites/eventos:", err);
        if (!cancelled) {
          setSitesError(
            err?.message ?? "Falha ao carregar dados dos sites UniFi."
          );
        }
      } finally {
        if (!cancelled) setSitesLoading(false);
      }
    }

    loadSitesAndEvents();

    // refresh leve a cada 60s
    const interval = window.setInterval(loadSitesAndEvents, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // --------- AUTO-SCROLL EM MODO TV --------- //

  useEffect(() => {
    if (!tvMode) return;
    const container = tvScrollRef.current;
    if (!container) return;

    let direction = 1;
    const step = 1;
    const interval = window.setInterval(() => {
      if (!container) return;
      const maxScroll = container.scrollHeight - container.clientHeight;

      if (container.scrollTop >= maxScroll - 2) {
        direction = -1;
      } else if (container.scrollTop <= 2) {
        direction = 1;
      }

      container.scrollTop += step * direction;
    }, 40);

    return () => {
      window.clearInterval(interval);
    };
  }, [tvMode]);

  // --------- DERIVADOS (STATS + FILTRO) --------- //

  const {
    totalSites,
    totalOffline,
    totalUnstable,
    totalOperational,
  } = useMemo(() => {
    if (!sitesStats) {
      const agg = sites.reduce(
        (acc, s) => {
          acc.totalSites += 1;
          if (s.overallStatus === "online") acc.online += 1;
          else if (s.overallStatus === "offline") acc.offline += 1;
          else if (s.overallStatus === "unstable") acc.unstable += 1;
          else acc.unknown += 1;

          if (
            s.overallStatus === "online" ||
            s.overallStatus === "unstable"
          ) {
            acc.operational += 1;
          }
          return acc;
        },
        {
          totalSites: 0,
          online: 0,
          offline: 0,
          unstable: 0,
          unknown: 0,
          operational: 0,
        }
      );

      return {
        totalSites: agg.totalSites,
        totalOffline: agg.offline,
        totalUnstable: agg.unstable,
        totalOperational: agg.operational,
      };
    }

    return {
      totalSites: sitesStats.totalSites,
      totalOffline: sitesStats.offline,
      totalUnstable: sitesStats.unstable,
      totalOperational: sitesStats.operational,
    };
  }, [sites, sitesStats]);

  const filteredSites = useMemo(() => {
    if (!sites) return [];
    switch (filter) {
      case "online":
        return sites.filter((s) => s.overallStatus === "online");
      case "unstable":
        return sites.filter((s) => s.overallStatus === "unstable");
      case "offline":
        return sites.filter((s) => s.overallStatus === "offline");
      default:
        return sites;
    }
  }, [sites, filter]);

  const headerTitle = "Hype Watchdog";
  const headerSubtitle = "Visão geral dos sites UniFi + eventos.";

  // --------- RENDER --------- //

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-50 ${
        tvMode ? "overflow-hidden" : ""
      }`}
    >
      <main className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4">
        {/* HEADER */}
        <header>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {headerTitle}
              </h1>
              <p className="text-xs text-slate-400 mt-1">{headerSubtitle}</p>
            </div>

            <div className="text-right text-xs text-slate-400 space-y-[2px]">
              <div>
                <span className="font-semibold text-slate-100">
                  {totalOperational}
                </span>{" "}
                / {totalSites} sites online ·{" "}
                <span className="text-amber-300">{totalUnstable}</span>{" "}
                instáveis ·{" "}
                <span className="text-red-400">{totalOffline}</span> offline
              </div>
              <div className="text-[10px] text-slate-500">
                TV mode: adicione{" "}
                <code className="px-1 py-[1px] bg-slate-900 rounded">
                  ?tv=1
                </code>{" "}
                na URL
              </div>
            </div>
          </div>

          {/* FILTROS */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Todos
            </FilterChip>
            <FilterChip
              active={filter === "online"}
              onClick={() => setFilter("online")}
            >
              Online
            </FilterChip>
            <FilterChip
              active={filter === "unstable"}
              onClick={() => setFilter("unstable")}
            >
              Instáveis
            </FilterChip>
            <FilterChip
              active={filter === "offline"}
              onClick={() => setFilter("offline")}
            >
              Offline
            </FilterChip>
          </div>
        </header>

        {/* CONTEÚDO ROLÁVEL EM MODO TV (SITES + EVENTOS) */}
        <div
          ref={tvScrollRef}
          className={`mt-1 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start ${
            tvMode ? "overflow-y-auto pr-1 pb-4" : ""
          }`}
          style={
            tvMode
              ? {
                  maxHeight: "calc(100vh - 96px)",
                }
              : undefined
          }
        >
          {/* Coluna esquerda: sites */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-1">
              Sites monitorados
            </h2>

            {sitesError && (
              <div className="text-xs text-red-400 mb-2">
                {sitesError} Verifique o backend UniFi.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredSites.map((site, index) =>
                renderSiteCard(site, index)
              )}

              {!sitesLoading && filteredSites.length === 0 && (
                <div className="col-span-full text-sm text-slate-400 py-6 text-center border border-dashed border-slate-700 rounded-2xl">
                  Nenhum site encontrado para o filtro atual.
                </div>
              )}
            </div>
          </div>

          {/* Coluna direita: eventos recentes */}
          <aside className="flex flex-col gap-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-1">
              Eventos recentes
            </h2>

            <div
              ref={eventsRef}
              className={
                "rounded-2xl border border-slate-800 bg-slate-900/40 p-3 min-h-[160px]" +
                (tvMode ? "" : " max-h-[60vh] overflow-y-auto")
              }
            >
              {eventsLoading && (
                <div className="text-xs text-slate-400">
                  Carregando eventos...
                </div>
              )}

              {!eventsLoading && events.length === 0 && (
                <div className="text-xs text-slate-500">
                  Nenhum evento recente (ou DB offline).
                </div>
              )}

              {!eventsLoading && events.length > 0 && (
                <div className="space-y-2 text-xs">
                  {events.slice(0, 50).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-2 border-b border-slate-800/70 pb-1 last:border-0 last:pb-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={severityBadgeClasses(ev.severity)}>
                            {ev.severity}
                          </span>
                          <span className="truncate max-w-[160px]">
                            {ev.siteName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {ev.title}
                        </div>
                        {ev.message && (
                          <div className="text-[10px] text-slate-500 line-clamp-2">
                            {ev.message}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-[10px] text-slate-500 whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {ev.isPrimaryHost && (
                          <div className="text-[9px] text-emerald-300">
                            host primário
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// --------- COMPONENTES AUXILIARES --------- //

function FilterChip(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { active, onClick, children } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
        active
          ? "bg-emerald-500/20 border-emerald-400 text-emerald-100"
          : "bg-slate-900/50 border-slate-700 text-slate-300 hover:border-slate-500"
      }`}
    >
      {children}
    </button>
  );
}

function renderSiteCard(site: SiteStatusSummary, index: number) {
  const key = site.hostId ?? site.siteId ?? `${site.siteName}-${index}`;

  const primaryStatus: "online" | "offline" | "unknown" =
    site.overallStatus === "offline"
      ? "offline"
      : site.overallStatus === "unknown"
      ? "unknown"
      : "online";

  const statusLabel = statusToLabel(primaryStatus);
  const statusClasses = statusToBadgeClasses(primaryStatus);

  const showUnstableChip = site.overallStatus === "unstable";

  const total = site.deviceStats.total ?? 0;
  const online = site.deviceStats.online ?? 0;
  const offline = site.deviceStats.offline ?? 0;
  const unstable = site.deviceStats.unstable ?? 0;

  const controllerLabel =
    site.controllerOnline === null
      ? "unknown"
      : site.controllerOnline
      ? "online"
      : "offline";

  const wan1Label = site.wan1 ?? "N/A";
  const wan2Label = site.wan2 ?? "N/A";

  const siteDetailId = site.siteId ?? site.hostId ?? "";

  return (
    <Link
      href={siteDetailId ? `/sites/${encodeURIComponent(siteDetailId)}` : "#"}
      key={key}
      className="block"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 flex flex-col gap-2 hover:border-slate-600 hover:bg-slate-900/70 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-sm truncate">{site.siteName}</div>

          <div className="flex items-center gap-1">
            <span className={statusClasses}>{statusLabel}</span>

            {showUnstableChip && (
              <span className="px-2 py-[2px] rounded-full text-[10px] font-semibold bg-amber-500/15 border border-amber-400 text-amber-200">
                instável
              </span>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Dev:{" "}
            <span className="text-emerald-300">
              {online}/{total}
            </span>
          </span>
          <span>
            Off: <span className="text-red-400">{offline}</span>
          </span>
          <span>
            Unst: <span className="text-amber-300">{unstable}</span>
          </span>
        </div>

        <div className="text-[11px] text-slate-500 space-y-[2px] mt-1">
          <div>
            Ctr:{" "}
            <span
              className={
                controllerLabel === "online"
                  ? "text-emerald-300"
                  : controllerLabel === "offline"
                  ? "text-red-400"
                  : "text-slate-400"
              }
            >
              {controllerLabel}
            </span>
          </div>
          <div>
            WAN1:{" "}
            <span
              className={
                wan1Label === "online"
                  ? "text-emerald-300"
                  : wan1Label === "offline"
                  ? "text-red-400"
                  : wan1Label === "unstable"
                  ? "text-amber-300"
                  : "text-slate-400"
              }
            >
              {wan1Label}
            </span>{" "}
            WAN2:{" "}
            <span
              className={
                wan2Label === "online"
                  ? "text-emerald-300"
                  : wan2Label === "offline"
                  ? "text-red-400"
                  : wan2Label === "unstable"
                  ? "text-amber-300"
                  : "text-slate-400"
              }
            >
              {wan2Label}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function statusToLabel(status: "online" | "offline" | "unknown"): string {
  if (status === "online") return "ONLINE";
  if (status === "offline") return "OFFLINE";
  return "UNKNOWN";
}

function statusToBadgeClasses(
  status: "online" | "offline" | "unknown"
): string {
  const base =
    "px-3 py-[3px] rounded-full text-[11px] font-semibold border inline-flex items-center";
  if (status === "online") {
    return `${base} bg-emerald-500/15 border-emerald-500 text-emerald-200`;
  }
  if (status === "offline") {
    return `${base} bg-red-500/15 border-red-500 text-red-200`;
  }
  return `${base} bg-slate-700/40 border-slate-500 text-slate-200`;
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