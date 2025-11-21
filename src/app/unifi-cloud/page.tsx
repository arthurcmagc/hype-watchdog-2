// src/app/unifi-cloud/page.tsx
import { listUnifiDevices } from '@/lib/unifiClient';

export const dynamic = 'force-dynamic'; // sempre busca dados novos do servidor

type Row = {
  hostName: string;
  mac: string;
  model: string;
  name: string;
  ip: string;
  status: string;
};

export default async function UnifiCloudPage() {
  const devicesResponse = await listUnifiDevices();
  const hosts = devicesResponse.data ?? [];

  // Flatten: transforma hosts + devices em uma linha por device
  const rows: Row[] = hosts.flatMap((host) =>
    (host.devices ?? []).map((device) => ({
      hostName: host.hostName,
      mac: device.mac ?? '-',
      model: device.model ?? '-',
      name: device.name ?? '-',
      ip: device.ipAddress ?? '-',
      status: device.status ?? '-',
    })),
  );

  // --- métricas da dashboard mínima ---
  const totalHosts = hosts.length;
  const totalDevices = rows.length;
  const onlineCount = rows.filter((r) => r.status === 'online').length;
  const offlineCount = rows.filter((r) => r.status === 'offline').length;
  const onlinePercent =
    totalDevices > 0 ? Math.round((onlineCount / totalDevices) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#050711] text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">
            UniFi Cloud — Dispositivos (API /v1/devices)
          </h1>
          <p className="text-sm text-slate-400">
            Listando dispositivos retornados pelo endpoint{' '}
            <code className="font-mono text-xs bg-slate-900 px-1.5 py-0.5 rounded">
              /v1/devices
            </code>{' '}
            da UniFi Cloud, agrupados por host/site e exibidos em uma tabela.
          </p>
        </header>

        {/* Dashboard mínima */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard
            label="Sites / Hosts"
            value={totalHosts.toString()}
            helper="Hosts retornados pela API"
          />
          <DashboardCard
            label="Dispositivos"
            value={totalDevices.toString()}
            helper="Total de devices UniFi"
          />
          <DashboardCard
            label="Online"
            value={onlineCount.toString()}
            helper={`${onlinePercent}% dos devices`}
            accent="online"
          />
          <DashboardCard
            label="Offline"
            value={offlineCount.toString()}
            helper={
              totalDevices > 0
                ? `${offlineCount} devices`
                : 'Nenhum device cadastrado'
            }
            accent="offline"
          />
        </section>

        {/* Tabela */}
        <section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-4 py-2 text-left">Site / Host</th>
                <th className="px-4 py-2 text-left">Nome do Device</th>
                <th className="px-4 py-2 text-left">Modelo</th>
                <th className="px-4 py-2 text-left">MAC</th>
                <th className="px-4 py-2 text-left">IP</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>

            {/* suppressHydrationWarning para evitar warning chatinho em dev */}
            <tbody suppressHydrationWarning>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Nenhum dispositivo retornado pela UniFi Cloud.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={`${row.mac}-${idx}`}
                    className={
                      idx % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-950/10'
                    }
                  >
                    <td className="px-4 py-2">{row.hostName}</td>
                    <td className="px-4 py-2">{row.name}</td>
                    <td className="px-4 py-2">{row.model}</td>
                    <td className="px-4 py-2 font-mono text-xs">{row.mac}</td>
                    <td className="px-4 py-2 font-mono text-xs">{row.ip}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          row.status === 'online'
                            ? 'text-emerald-400'
                            : row.status === 'offline'
                            ? 'text-rose-400'
                            : 'text-amber-300'
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

/**
 * Cardzinho simples pra dashboard mínima
 */
type DashboardCardProps = {
  label: string;
  value: string;
  helper?: string;
  accent?: 'online' | 'offline';
};

function DashboardCard({ label, value, helper, accent }: DashboardCardProps) {
  const accentClass =
    accent === 'online'
      ? 'text-emerald-400'
      : accent === 'offline'
      ? 'text-rose-400'
      : 'text-slate-100';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className={`text-xl font-semibold ${accentClass}`}>{value}</span>
      {helper && (
        <span className="text-xs text-slate-500 leading-snug">{helper}</span>
      )}
    </div>
  );
}