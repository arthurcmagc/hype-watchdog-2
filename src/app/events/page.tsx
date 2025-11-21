"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type SeverityFilter = "ALL" | "CRITICAL" | "WARNING" | "INFO";

type EventItem = {
  id: number;
  siteName: string;
  deviceName: string;
  severity: string;
  title: string;
  message: string | null;
  eventType: string;
  createdAt: string;
  isPrimaryHost: boolean;
};

export default function EventsPage() {
  const searchParams = useSearchParams();
  const tvMode = searchParams.get("tv") === "1";

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SeverityFilter>("ALL");
  const [primaryOnly, setPrimaryOnly] = useState<boolean>(false);
  const [refreshToken, setRefreshToken] = useState(0);

  // Auto-refresh a cada 30s em TV Mode
  useEffect(() => {
    if (!tvMode) return;

    const id = setInterval(() => {
      setRefreshToken((t) => t + 1);
    }, 30_000);

    return () => clearInterval(id);
  }, [tvMode]);

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          severity,
          primaryOnly: primaryOnly ? "true" : "false",
        });

        const res = await fetch(`/api/events?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status}`);
        }

        const data = (await res.json()) as EventItem[];
        setEvents(data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Falha ao carregar eventos.");
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, [severity, primaryOnly, refreshToken]);

  const severityOptions: { key: SeverityFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "CRITICAL", label: "Critical" },
    { key: "WARNING", label: "Warning" },
    { key: "INFO", label: "Info" },
  ];

  function severityClasses(s: string) {
    const sev = s.toUpperCase();
    if (sev === "CRITICAL")
      return "bg-rose-500/10 text-rose-300 border-rose-500/40";
    if (sev === "WARNING")
      return "bg-amber-500/10 text-amber-300 border-amber-500/40";
    if (sev === "INFO")
      return "bg-sky-500/10 text-sky-300 border-sky-500/40";
    return "bg-slate-500/10 text-slate-300 border-slate-500/40";
  }

  return (
    <div className="space-y-6">
      {!tvMode && (
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Events & Alerts
          </h1>
          <p className="text-sm text-slate-400">
            Monitor device status changes and alerts.
          </p>
        </div>
      )}

      {tvMode && (
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Events & Alerts
          </h1>
          <p className="text-xs text-slate-500">
            Atualizando automaticamente (TV mode)
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400">Filter by severity:</span>
          <div className="flex flex-wrap gap-2">
            {severityOptions.map((opt) => {
              const active = severity === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSeverity(opt.key)}
                  className={[
                    "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                    active
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-100"
                      : "border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-500/60",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => setPrimaryOnly((p) => !p)}
          className={[
            "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
            primaryOnly
              ? "border-emerald-500 bg-emerald-500/20 text-emerald-100"
              : "border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500/60",
          ].join(" ")}
        >
          {primaryOnly ? "Showing MAIN HOSTS only" : "Include all devices"}
        </button>
      </div>

      {/* Lista de eventos */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        {error && (
          <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-xs text-slate-500">Carregando eventos…</p>
        ) : events.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhum evento encontrado com os filtros atuais.
          </p>
        ) : (
          <div className="space-y-3 text-xs">
            {events.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {e.siteName} • {e.deviceName}
                    </p>
                    <p className="text-sm font-semibold text-slate-100">
                      {e.title}
                    </p>
                  </div>
                  <span
                    className={
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                      severityClasses(e.severity)
                    }
                  >
                    {e.severity.toUpperCase()}
                  </span>
                </div>
                {e.message && (
                  <p className="mb-1 text-[11px] text-slate-400">
                    {e.message}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                  <span>Event Type: {e.eventType}</span>
                  {e.isPrimaryHost && (
                    <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">
                      MAIN HOST
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}