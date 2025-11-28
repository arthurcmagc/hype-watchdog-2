// src/lib/siteStatus.ts

// ---------------------------------------------------------------------------
// Tipos básicos
// ---------------------------------------------------------------------------

export type OverallStatus = "online" | "offline" | "unstable" | "unknown";

export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  unstable: number;
  unknown: number;
}

export interface SiteStatusSummary {
  siteId: string | null;
  hostId: string | null;
  siteName: string;
  controllerOnline: boolean | null;
  wan1: OverallStatus | null;
  wan2: OverallStatus | null;
  overallStatus: OverallStatus;
  deviceStats: DeviceStats;
  debug?: {
    rawSiteSample?: any;
    deviceHostSample?: any;
    countsHint?: ReturnType<typeof computeStrongOfflineHint>;
    devicesStatus?: OverallStatus;
  };
}

export function emptyDeviceStats(): DeviceStats {
  return {
    total: 0,
    online: 0,
    offline: 0,
    unstable: 0,
    unknown: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers de WAN
// ---------------------------------------------------------------------------

function mapWanStatus(wan: any | undefined | null): OverallStatus | null {
  if (!wan) return null;

  const issues = Array.isArray(wan.wanIssues) ? wan.wanIssues : [];
  const hasDowntime = issues.some((i: any) => i?.wanDowntime === true);
  const hasHighLatency = issues.some((i: any) => i?.highLatency === true);

  const uptimeRaw =
    typeof wan.wanUptime !== "undefined"
      ? wan.wanUptime
      : typeof wan.percentages?.wanUptime !== "undefined"
      ? wan.percentages.wanUptime
      : null;

  const uptime =
    typeof uptimeRaw === "number"
      ? uptimeRaw
      : typeof uptimeRaw === "string"
      ? Number(uptimeRaw)
      : null;

  // 1) uptime 0 -> offline seco
  if (uptime === 0) return "offline";

  // 2) qualquer downtime/latência alta -> unstable
  if (hasDowntime || hasHighLatency) return "unstable";

  // 3) sem uptime confiável
  if (uptime == null || Number.isNaN(uptime)) return "unknown";

  // 4) uptime < 80 -> offline
  if (uptime < 80) return "offline";

  // 5) uptime > 95 -> online
  if (uptime > 95) return "online";

  // 6) meio termo -> online (não vamos pirar por 90% de uptime)
  return "online";
}

function normalizeStatus(
  value: string | null | undefined
): OverallStatus {
  if (!value) return "unknown";
  const v = String(value).toLowerCase();
  if (v === "online" || v === "offline" || v === "unstable" || v === "unknown")
    return v as OverallStatus;
  return "unknown";
}

// ---------------------------------------------------------------------------
// Controller + Devices
// ---------------------------------------------------------------------------

function controllerOnlineFromDeviceHost(
  deviceHost: any | null | undefined
): boolean | null {
  if (!deviceHost || !Array.isArray(deviceHost.devices)) return null;
  const consoleDevice = deviceHost.devices.find((d: any) => d && d.isConsole);
  if (!consoleDevice) return null;

  const status = typeof consoleDevice.status === "string"
    ? consoleDevice.status.toLowerCase()
    : "";

  if (status === "online") return true;
  if (!status) return null;
  return false;
}

/**
 * Devices:
 * - ignora unmanaged (isManaged === false)
 * - se tem console, conta só devices não-console;
 *   se não tiver nenhum não-console, conta só o console.
 * - qualquer status !== "online" entra como offline (pending adoption, etc).
 */
function computeDeviceStatsFromHost(deviceHost: any | null | undefined): DeviceStats {
  if (!deviceHost || !Array.isArray(deviceHost.devices)) {
    return emptyDeviceStats();
  }

  const managed = (deviceHost.devices as any[]).filter(
    (d) => d && d.isManaged !== false
  );

  const consoleDevice = managed.find((d) => d.isConsole);
  let considered: any[];

  if (consoleDevice) {
    const nonConsole = managed.filter((d) => !d.isConsole);
    considered = nonConsole.length > 0 ? nonConsole : [consoleDevice];
  } else {
    considered = managed;
  }

  const total = considered.length;
  let offline = 0;

  for (const d of considered) {
    const status = typeof d.status === "string" ? d.status.toLowerCase() : "";
    if (status && status !== "online") offline += 1;
  }

  const online = Math.max(total - offline, 0);

  return {
    total,
    online,
    offline,
    unstable: 0,
    unknown: 0,
  };
}

/**
 * - 0 devices       -> "online" (não derruba site)
 * - 0 offline       -> "online"
 * - >= 50% offline  -> "offline"
 * - 10–49% offline  -> "unstable"
 * - < 10% offline   -> "online"
 */
function computeDevicesStatus(
  totalDevices: number,
  offlineDevices: number
): OverallStatus {
  if (totalDevices === 0) return "online";
  if (offlineDevices === 0) return "online";

  const ratio = offlineDevices / totalDevices;
  if (ratio >= 0.5) return "offline";
  if (ratio >= 0.1) return "unstable";
  return "online";
}

// ---------------------------------------------------------------------------
// Hints baseados em rawSite.statistics.counts (sites zumbis)
// ---------------------------------------------------------------------------

function computeStrongOfflineHint(rawSite: any | undefined | null): {
  strongOfflineHint: boolean;
  totalDevice: number | null;
  offlineDevice: number | null;
  gatewayDevice: number | null;
  offlineGatewayDevice: number | null;
} {
  const counts = rawSite?.statistics?.counts ?? {};

  const totalDevice =
    typeof counts.totalDevice === "number" ? counts.totalDevice : null;
  const offlineDevice =
    typeof counts.offlineDevice === "number" ? counts.offlineDevice : null;
  const gatewayDevice =
    typeof counts.gatewayDevice === "number" ? counts.gatewayDevice : null;
  const offlineGatewayDevice =
    typeof counts.offlineGatewayDevice === "number"
      ? counts.offlineGatewayDevice
      : null;

  let strongOfflineHint = false;

  // todos devices offline
  if (
    totalDevice !== null &&
    totalDevice > 0 &&
    offlineDevice !== null &&
    offlineDevice >= totalDevice
  ) {
    strongOfflineHint = true;
  }

  // todos gateways offline
  if (
    gatewayDevice !== null &&
    gatewayDevice > 0 &&
    offlineGatewayDevice !== null &&
    offlineGatewayDevice >= gatewayDevice
  ) {
    strongOfflineHint = true;
  }

  return {
    strongOfflineHint,
    totalDevice,
    offlineDevice,
    gatewayDevice,
    offlineGatewayDevice,
  };
}

// ---------------------------------------------------------------------------
// Lógica principal de status
// ---------------------------------------------------------------------------

function computeOverallStatus(params: {
  totalDevices: number;
  offlineDevices: number;
  wan1Status: OverallStatus | null;
  wan2Status: OverallStatus | null;
  controllerOnline: boolean | null;
  strongOfflineHint: boolean;
}): OverallStatus {
  const {
    totalDevices,
    offlineDevices,
    wan1Status,
    wan2Status,
    controllerOnline,
    strongOfflineHint,
  } = params;

  const devicesStatus = computeDevicesStatus(totalDevices, offlineDevices);

  const w1 = normalizeStatus(wan1Status);
  const w2 = normalizeStatus(wan2Status);

  const knownWans = [w1, w2].filter((s) => s !== "unknown");
  const anyWanOffline = knownWans.some((s) => s === "offline");
  const anyWanUnstable = knownWans.some((s) => s === "unstable");
  const noWanInfo = knownWans.length === 0;

  const allDevicesOffline =
    totalDevices > 0 && offlineDevices === totalDevices;

  // 1) completamente cego
  if (noWanInfo && totalDevices === 0 && controllerOnline == null) {
    return "unknown";
  }

  // 2) hint forte de site zumbi -> offline
  if (strongOfflineHint) {
    return "offline";
  }

  // 3) todos devices reais offline + (controller offline OU WAN offline)
  if (
    allDevicesOffline &&
    (controllerOnline === false || anyWanOffline)
  ) {
    return "offline";
  }

  // 4) sem devices, mas controller offline ou WAN offline
  if (totalDevices === 0 && (controllerOnline === false || anyWanOffline)) {
    return "offline";
  }

  // 5) controller offline mas ainda há devices vivos -> unstable
  if (controllerOnline === false && !allDevicesOffline && totalDevices > 0) {
    return "unstable";
  }

  // 6) devices agregados dizem "offline" (ex: maioria esmagadora caiu)
  if (devicesStatus === "offline") {
    return "offline";
  }

  // 7) devices agregados dizem "unstable"
  if (devicesStatus === "unstable") {
    return "unstable";
  }

  // 8) WAN instável
  if (anyWanUnstable) {
    return "unstable";
  }

  // 9) default = online
  return "online";
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

export function computeSiteStatus(input: {
  rawSite?: any;
  deviceHost?: any | null;
}): SiteStatusSummary {
  const { rawSite, deviceHost } = input;

  // IDs
  const siteId: string | null =
    rawSite?.siteId ?? rawSite?._id ?? rawSite?.site_id ?? null;

  const hostId: string | null =
    rawSite?.hostId ??
    rawSite?.host_id ??
    deviceHost?.hostId ??
    deviceHost?.id ??
    null;

  // Nome
  const metaDesc: string | undefined =
    typeof rawSite?.meta?.desc === "string"
      ? rawSite.meta.desc.trim()
      : undefined;
  const cleanMetaDesc =
    metaDesc && metaDesc.toLowerCase() !== "default" ? metaDesc : undefined;

  let siteName: string =
    (deviceHost?.hostName && String(deviceHost.hostName).trim()) ||
    (deviceHost?.name && String(deviceHost.name).trim()) ||
    cleanMetaDesc ||
    (rawSite?.meta?.name && String(rawSite.meta.name).trim()) ||
    (rawSite?.siteName && String(rawSite.siteName).trim()) ||
    "Unknown";

  if (siteName.trim().toLowerCase() === "default") {
    siteName = "Unknown";
  }

  // Controller
  const controllerOnline = controllerOnlineFromDeviceHost(deviceHost);

  // WANs
  const wans = rawSite?.statistics?.wans;
  let wan1Status = mapWanStatus(wans?.WAN);
  let wan2Status = mapWanStatus(wans?.WAN2);

  // Devices
  const deviceStats = computeDeviceStatsFromHost(deviceHost);

  // Hint de site zumbi
  const countsHint = computeStrongOfflineHint(rawSite);

  // Se counts dizem "tudo morto" + controller offline, não faz sentido WAN online
  if (countsHint.strongOfflineHint && controllerOnline === false) {
    if (wan1Status === "online") wan1Status = "offline";
    if (wan2Status === "online") wan2Status = "offline";
  }

  const overallStatus = computeOverallStatus({
    totalDevices: deviceStats.total,
    offlineDevices: deviceStats.offline,
    wan1Status,
    wan2Status,
    controllerOnline,
    strongOfflineHint: countsHint.strongOfflineHint,
  });

  return {
    siteId,
    hostId,
    siteName,
    controllerOnline,
    wan1: wan1Status,
    wan2: wan2Status,
    overallStatus,
    deviceStats,
    debug: {
      rawSiteSample: rawSite,
      deviceHostSample: deviceHost,
      countsHint,
      devicesStatus: computeDevicesStatus(
        deviceStats.total,
        deviceStats.offline
      ),
    },
  };
}