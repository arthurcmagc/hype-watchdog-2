'use client';

import { useEffect, useMemo, useState } from 'react';

type HostStatus = 'ONLINE' | 'UNSTABLE' | 'OFFLINE' | 'UNKNOWN';

type StatusFilter = HostStatus | 'ALL';

interface HostRow {
  id: string;
  siteName: string;
  hostName: string;
  ipAddress: string | null;
  status: HostStatus | null;
  wan1Status: string | null;
  wan2Status: string | null;
  lastSeenAt: string | null;
}

interface DashboardData {
  hosts: HostRow[];
  error: string | null;
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({ hosts: [], error: null });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setData({ hosts: [], error: null });

        const res = await fetch('/api/hosts');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const hosts = (await res.json()) as HostRow[];

        setData({ hosts, error: null });
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard', error);
        setData({
          hosts: [],
          error:
            'Erro ao carregar dados do dashboard. Verifique o banco / Prisma ou rode o seed/sync.',
        });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Deriva contagens a partir dos hosts
  const stats = useMemo(() => {
    const total = data.hosts.length;

    const byStatus = {
      ONLINE: data.hosts.filter((h) => h.status === 'ONLINE').length,
      UNSTABLE: data.hosts.filter((h) => h.status === 'UNSTABLE').length,
      OFFLINE: data.hosts.filter((h) => h.status === 'OFFLINE').length,
      UNKNOWN: data.hosts.filter((h) => h.status === 'UNKNOWN').length,
    };

    return { total, ...byStatus };
  }, [data.hosts]);

  const filteredHosts = useMemo(() => {
    if (filter === 'ALL') return data.hosts;
    return data.hosts.filter((h) => h.status === filter);
  }, [data.hosts, filter]);

  function handleToggleFilter(next: HostStatus) {
    setFilter((current) => (current === next ? 'ALL' : next));
  }

  return (
    <main className="min-h-screen bg-[#050711] text-slate-100 px-8 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Título / cabeçalho simples */}
        <header>
          <h1 className="text-2xl font-semibold">Overall Status (Hosts)</h1>
          <p className="text-sm text-slate-400">
            Monitorando {stats.total} hosts principais.
          </p>
        </header>

        {/* Cards de status, estilo “Mocha-like” */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => handleToggleFilter('ONLINE')}
            className={classNames(
              'rounded-xl border px-5 py-4 text-left transition',
              'bg-gradient-to-br from-emerald-900/50 to-emerald-800/20',
              filter === 'ONLINE'
                ? 'border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.6)]'
                : 'border-emerald-900/60 hover:border-emerald-500/80'
            )}
          >
            <div className="text-xs font-medium text-emerald-200/80">ONLINE</div>
            <div className="mt-1 text-3xl font-semibold">{stats.ONLINE}</div>
            <div className="mt-1 text-[11px] text-emerald-100/70">
              Clique para filtrar hosts por status
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleFilter('UNSTABLE')}
            className={classNames(
              'rounded-xl border px-5 py-4 text-left transition',
              'bg-gradient-to-br from-amber-900/60 to-amber-800/20',
              filter === 'UNSTABLE'
                ? 'border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.7)]'
                : 'border-amber-900/60 hover:border-amber-500/80'
            )}
          >
            <div className="text-xs font-medium text-amber-200/80">UNSTABLE</div>
            <div className="mt-1 text-3xl font-semibold">{stats.UNSTABLE}</div>
            <div className="mt-1 text-[11px] text-amber-100/70">
              Clique para filtrar hosts por status
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleFilter('OFFLINE')}
            className={classNames(
              'rounded-xl border px-5 py-4 text-left transition',
              'bg-gradient-to-br from-rose-950 to-rose-900/30',
              filter === 'OFFLINE'
                ? 'border-rose-400 shadow-[0_0_0_1px_rgba(248,113,113,0.7)]'
                : 'border-rose-900/80 hover:border-rose-500/80'
            )}
          >
            <div className="text-xs font-medium text-rose-200/80">OFFLINE</div>
            <div className="mt-1 text-3xl font-semibold">{stats.OFFLINE}</div>
            <div className="mt-1 text-[11px] text-rose-100/70">
              Clique para filtrar hosts por status
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleFilter('UNKNOWN')}
            className={classNames(
              'rounded-xl border px-5 py-4 text-left transition',
              'bg-gradient-to-br from-slate-900 to-slate-800/40',
              filter === 'UNKNOWN'
                ? 'border-slate-400 shadow-[0_0_0_1px_rgba(148,163,184,0.7)]'
                : 'border-slate-800 hover:border-slate-500/80'
            )}
          >
            <div className="text-xs font-medium text-slate-200/80">UNKNOWN</div>
            <div className="mt-1 text-3xl font-semibold">{stats.UNKNOWN}</div>
            <div className="mt-1 text-[11px] text-slate-100/70">
              Clique para filtrar hosts por status
            </div>
          </button>
        </section>

        {/* Estado / erro de carregamento */}
        {data.error && (
          <div className="rounded-lg border border-rose-700/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {data.error}
          </div>
        )}

        {/* Lista de sites/hosts */}
        <section className="rounded-xl border border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
            <div>
              <div className="text-sm font-medium">Sites (hosts principais)</div>
              <div className="text-[11px] text-slate-400">
                Lista baseada no filtro selecionado nos cards acima.
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              Filtro atual:{' '}
              <span className="font-semibold text-slate-200">
                {filter === 'ALL' ? 'TODOS' : filter}
              </span>
            </div>
          </div>

          <div className="px-5 py-4 text-sm">
            {loading ? (
              <div className="text-slate-400">Carregando hosts...</div>
            ) : filteredHosts.length === 0 ? (
              <div className="text-slate-400">
                Nenhum host encontrado para o filtro atual.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHosts.map((host) => (
                  <div
                    key={host.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between rounded-lg border border-slate-800/80 bg-slate-950/60 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">{host.siteName}</div>
                        <span className="rounded-full bg-slate-800 px-2 py-[2px] text-[10px] uppercase tracking-wide text-slate-200">
                          {host.hostName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        IP:{' '}
                        <span className="font-mono text-[11px] text-slate-200">
                          {host.ipAddress || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-4 md:mt-0">
                      <div className="text-[11px] text-slate-400">
                        WAN1:{' '}
                        <span className="font-semibold text-slate-100">
                          {host.wan1Status || '-'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        WAN2:{' '}
                        <span className="font-semibold text-slate-100">
                          {host.wan2Status || '-'}
                        </span>
                      </div>
                      <div>
                        <span
                          className={classNames(
                            'rounded-full px-3 py-[3px] text-[11px] font-semibold uppercase tracking-wide',
                            host.status === 'ONLINE' &&
                              'bg-emerald-900/60 text-emerald-200 border border-emerald-600/60',
                            host.status === 'OFFLINE' &&
                              'bg-rose-950/70 text-rose-200 border border-rose-700/70',
                            host.status === 'UNSTABLE' &&
                              'bg-amber-900/70 text-amber-100 border border-amber-600/70',
                            host.status === 'UNKNOWN' &&
                              'bg-slate-900/70 text-slate-200 border border-slate-600/70'
                          )}
                        >
                          {host.status ?? 'UNKNOWN'}
                        </span>
                      </div>
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