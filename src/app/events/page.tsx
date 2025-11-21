"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Severity = "ALL" | "CRITICAL" | "WARNING" | "INFO";

type EventItem = {
  id: number;
  siteName: string;
  deviceName: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  message?: string | null;
  eventType: string;
  createdAt: string;
  isPrimaryHost: boolean;
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityLabel(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "Critical";
    case "WARNING":
      return "Warning";
    case "INFO":
    default:
      return "Info";
  }
}

function severityBadgeClasses(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "bg-rose-900/40 text-rose-300 border border-rose-500/40";
    case "WARNING":
      return "bg-amber-900/40 text-amber-300 border border-amber-500/40";
    case "INFO":
    default:
      return "bg-sky-900/40 text-sky-300 border border-sky-500/40";
  }
}

function EventsPageInner() {
  const searchParams = useSearchParams();
  const isTvMode = searchParams.get("tv") === "1";

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<Severity>("ALL");
  const [includeAllDevices, setIncludeAllDevices] = useState(true);

  async function loadEvents() {
    try {
      setLoading(true);
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Erro ao carregar eventos");
      const data = (await res.json()) as EventItem[];
      setEvents(data);
    } catch (err) {
      console.error("Erro ao buscar /api/events:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  // TV mode: auto-refresh a cada 30s
  useEffect(() => {
    if (!isTvMode) return;
    const id = setInterval(() => {
      loadEvents();
    }, 30000);
    return () => clearInterval(id);
  }, [isTvMode]);

  const filtered = events.filter((evt) => {
    if (!includeAllDevices && !evt.isPrimaryHost) return false;
    if (severityFilter === "ALL") return true;
    return evt.severity === severityFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">
            Events &amp; Alerts
          </h1>
          <p className="text-sm text-slate-400">
            Monitor device status changes and alerts
            {isTvMode && " • Atualizando automaticamente (TV mode)"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
            Filtro: {severityFilter === "ALL" ? "Todos" : severityFilter}
          </span>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
            {includeAllDevices ? "Incluindo todos os devices" : "Somente hosts principais"}
          </span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {(["ALL", "CRITICAL", "WARNING", "INFO"] as Severity[]).map((level) => (
            <button
              key={level}
              onClick={() => setSeverityFilter(level)}
              className={[
                "rounded-full px-3 py-1 font-medium transition",
                severityFilter === level
                  ? "bg-slate-50 text-slate-900"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700",
              ].join(" ")}
            >
              {level === "ALL" ? "All" : level.charAt(0) + level.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIncludeAllDevices((v) => !v)}
          className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
        >
          {includeAllDevices ? "Include all devices" : "Only main hosts"}
        </button>
      </div>

      {/* Lista de eventos */}
      <div className="space-y-3">
        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
            Carregando eventos...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
            Nenhum evento encontrado para o filtro atual.
          </div>
        )}

        {filtered.map((evt) => (
          <div
            key={evt.id}
            className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-400">
                  {evt.siteName} • {evt.deviceName}
                </div>
                <div className="text-sm font-semibold text-slate-50">
                  {evt.title}
                </div>
                {evt.message && (
                  <div className="text-xs text-slate-400">{evt.message}</div>
                )}
                <div className="mt-1 text-[11px] text-slate-500">
                  Event Type: <span className="uppercase">{evt.eventType}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 text-[11px]">
                <span
                  className={
                    "rounded-full px-2 py-1 font-semibold " +
                    severityBadgeClasses(evt.severity)
                  }
                >
                  {severityLabel(evt.severity).toUpperCase()}
                </span>

                <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
                  {evt.isPrimaryHost ? "MAIN HOST" : "DEVICE"}
                </span>

                <span className="text-slate-500">{formatDate(evt.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-6 text-sm text-slate-400">
          Carregando eventos...
        </div>
      }
    >
      <EventsPageInner />
    </Suspense>
  );
}