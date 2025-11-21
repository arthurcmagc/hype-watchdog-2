// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';

type NormalizedStatus = 'ONLINE' | 'UNSTABLE' | 'OFFLINE' | 'UNKNOWN';

interface UnifiApiDevice {
  id?: string;
  mac?: string;
  model?: string;
  name?: string;
  ipAddress?: string;
  status?: string;
}

interface UnifiApiHost {
  hostId: string;
  hostName: string;
  devices: UnifiApiDevice[];
}

interface DashboardHostSummary {
  hostName: string;
  totalDevices: number;
  byStatus: Record<NormalizedStatus, number>;
  overallStatus: NormalizedStatus;
}

interface DashboardData {
  hosts: DashboardHostSummary[];
  totals: Record<NormalizedStatus, number>;
}

function normalizeDeviceStatus(status?: string): NormalizedStatus {
  const s = (status || '').toLowerCase();

  if (s === 'online') return 'ONLINE';
  if (s === 'offline') return 'OFFLINE';

  // Se a UniFi mandar algum outro status tipo 'disconnected', 'unknown', etc.
  if (s.includes('unstable') || s.includes('degraded')) return 'UNSTABLE';

  return 'UNKNOWN';
}

function computeOverallStatus(byStatus: Record<NormalizedStatus, number>): NormalizedStatus {
  const { ONLINE, UNSTABLE, OFFLINE, UNKNOWN } = byStatus;

  const totalKnown = ONLINE + UNSTABLE + OFFLINE;

  if (totalKnown === 0 && UNKNOWN > 0) return 'UNKNOWN';
  if (ONLINE > 0 && OFFLINE === 0 && UNSTABLE === 0) return 'ONLINE';
  if (OFFLINE > 0 && ONLINE === 0 && UNSTABLE === 0) return 'OFFLINE';
  if (ONLINE > 0 && OFFLINE > 0) return 'UNSTABLE';
  if (UNSTABLE > 0) return 'UNSTABLE';

  return 'UNKNOWN';
}

function extractHostsFromApi(json: any): UnifiApiHost[] {
  // /api/unifi-cloud/devices atualmente devolve algo como:
  // { data: [ { hostId, hostName, devices: [...] }, ... ] }
  if (Array.isArray(json?.data)) return json.data as UnifiApiHost[];
  if (Array.isArray(json?.data?.data)) return json.data.data as UnifiApiHost[];

  return [];
}

async function fetchDashboardData(): Promise<DashboardData> {
  const res = await fetch('/api/unifi-cloud/devices');

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = await res.json();
  const hostsFromApi = extractHostsFromApi(json);

  const hostMap = new Map<string, DashboardHostSummary>();

  for (const host of hostsFromApi) {
    const hostName = host.hostName || 'Unknown host';
    let summary = hostMap.get(hostName);

    if (!summary) {
      summary = {
        hostName,
        totalDevices: 0,
        byStatus: {
          ONLINE: 0,
          UNSTABLE: 0,
          OFFLINE: 0,
          UNKNOWN: 0,
        },
        overallStatus: 'UNKNOWN',
      };
      hostMap.set(hostName, summary);
    }

    for (const device of host.devices || []) {
      const nStatus = normalizeDeviceStatus(device.status);
      summary.byStatus[nStatus]++;
      summary.totalDevices++;
    }
  }

  const totals: Record<NormalizedStatus, number> = {
    ONLINE: 0,
    UNSTABLE: 0,
    OFFLINE: 0,
    UNKNOWN: 0,
  };

  for (const summary of hostMap.values()) {
    summary.overallStatus = computeOverallStatus(summary.byStatus);
    totals[summary.overallStatus]++;
  }

  const hosts = Array.from(hostMap.values()).sort((a, b) =>
    a.hostName.localeCompare(b.hostName, 'pt-BR'),
  );

  return { hosts, totals };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NormalizedStatus | 'ALL'>('ONLINE'); // começa em ONLINE como na Mocha

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchDashboardData();
        if (!cancelled) {
          setData(d);
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados do dashboard', err);
        if (!cancelled) {
          setError('Erro ao carregar dados do dashboard. Verifique a conexão com a UniFi Cloud.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const totals = data?.totals ?? {
    ONLINE: 0,
    UNSTABLE: 0,
    OFFLINE: 0,
    UNKNOWN: 0,
  };

  const hosts = data?.hosts ?? [];

  const filteredHosts =
    filter === 'ALL'
      ? hosts
      : hosts.filter((h) => h.overallStatus === filter);

  const filterLabel =
    filter === 'ALL'
      ? 'TODOS'
      : filter === 'ONLINE'
      ? 'ONLINE'
      : filter === 'OFFLINE'
      ? 'OFFLINE'
      : filter === 'UNSTABLE'
      ? 'UNSTABLE'
      : 'UNKNOWN';

  return (
    <main className="min-h-screen bg-[#050711] text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Overall Status (Hosts)</h1>
          <p className="text-sm text-slate-400">
            Monitorando {hosts.length} hosts (agrupados pela UniFi Cloud).
          </p>
        </header>

        {/* Cards de status */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatusCard
            label="ONLINE"
            value={totals.ONLINE}
            description="Clique para filtrar hosts por status"
            active={filter === 'ONLINE'}
            color="from-emerald-700/80 to-emerald-500/40"
            onClick={() => setFilter(filter === 'ONLINE' ? 'ALL' : 'ONLINE')}
          />
          <StatusCard
            label="UNSTABLE"
            value={totals.UNSTABLE}
            description="Clique para filtrar hosts por status"
            active={filter === 'UNSTABLE'}
            color="from-amber-800/80 to-amber-500/40"
            onClick={() => setFilter(filter === 'UNSTABLE' ? 'ALL' : 'UNSTABLE')}
          />
          <StatusCard
            label="OFFLINE"
            value={totals.OFFLINE}
            description="Clique para filtrar hosts por status"
            active={filter === 'OFFLINE'}
            color="from-rose-900/80 to-rose-500/40"
            onClick={() => setFilter(filter === 'OFFLINE' ? 'ALL' : 'OFFLINE')}
          />
          <StatusCard
            label="UNKNOWN"
            value={totals.UNKNOWN}
            description="Clique para filtrar hosts por status"
            active={filter === 'UNKNOWN'}
            color="from-slate-900/80 to-slate-600/40"
            onClick={() => setFilter(filter === 'UNKNOWN' ? 'ALL' : 'UNKNOWN')}
          />
        </section>

        {/* Aviso de erro, se tiver */}
        {error && (
          <div className="mb-4 rounded-lg border border-rose-700 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Lista de sites/hosts */}
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-semibold">Sites (hosts principais)</h2>
              <p className="text-xs text-slate-400">
                Lista baseada no filtro selecionado nos cards acima.
              </p>
            </div>
            <div className="text-xs text-slate-400">
              Filtro atual:{' '}
              <span className="font-semibold text-slate-200">{filterLabel}</span>
            </div>
          </div>

          <div className="px-4 py-3 text-sm">
            {loading && (
              <p className="text-slate-400">Carregando hosts a partir da UniFi Cloud...</p>
            )}

            {!loading && filteredHosts.length === 0 && (
              <p className="text-slate-400">
                Nenhum host encontrado para o filtro atual.
              </p>
            )}

            {!loading && filteredHosts.length > 0 && (
              <div className="space-y-2">
                {filteredHosts.map((host) => (
                  <div
                    key={host.hostName}
                    className="flex flex-col md:flex-row md:items-center md:justify-between rounded-lg bg-slate-900/60 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{host.hostName}</div>
                      <div className="text-xs text-slate-400">
                        {host.totalDevices} devices &middot;{' '}
                        {host.byStatus.ONLINE} online &middot;{' '}
                        {host.byStatus.OFFLINE} offline &middot;{' '}
                        {host.byStatus.UNSTABLE} unstable &middot;{' '}
                        {host.byStatus.UNKNOWN} unknown
                      </div>
                    </div>
                    <div className="mt-2 md:mt-0">
                      <span
                        className={
                          'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ' +
                          (host.overallStatus === 'ONLINE'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
                            : host.overallStatus === 'OFFLINE'
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/40'
                            : host.overallStatus === 'UNSTABLE'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-500/10 text-slate-300 border border-slate-500/40')
                        }
                      >
                        {host.overallStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

interface StatusCardProps {
  label: string;
  value: number;
  description: string;
  active?: boolean;
  color: string; // gradient tailwind classes
  onClick?: () => void;
}

function StatusCard({
  label,
  value,
  description,
  active,
  color,
  onClick,
}: StatusCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border px-4 py-4 text-left transition
        ${
          active
            ? 'border-slate-100 bg-gradient-to-br ' + color + ' shadow-lg shadow-black/40'
            : 'border-slate-800 bg-slate-950/60 hover:border-slate-500/70 hover:bg-slate-900/70'
        }`}
    >
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-2 text-[11px] text-slate-400">{description}</div>
      {active && (
        <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-400 shadow shadow-emerald-400/80" />
      )}
    </button>
  );
}