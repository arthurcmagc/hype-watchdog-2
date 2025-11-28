// src/lib/siteStatus.ts
//
// Lógica de status de sites UniFi (hosts do UniFi Cloud) usada pelo dashboard.
//
// Objetivos:
//  - Detectar "sites zumbis" usando deviceHost.updatedAt (host muito antigo).
//  - Corrigir falsos OFFLINE (CTMIG, OKAY, etc.) usando statistics.counts.
//  - Respeitar as regras de WAN / devices / controller / hints que você descreveu.
//  - Manter a estrutura de SiteStatusSummary compatível com o resto do projeto.
//

export type OverallStatus = "online" | "offline" | "unstable" | "unknown";

export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  unstable: number;
  unknown: number;
}

export interface StrongOfflineHint {
  strongOfflineHint: boolean;
  totalDevice: number | null;
  offlineDevice: number | null;
  gatewayDevice: number | null;
  offlineGatewayDevice: number | null;
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
    countsHint?: StrongOfflineHint;
    devicesStatus?: OverallStatus;
    isStale?: boolean;
    forcedOnlineByCounts?: boolean;
  };
}

export function emptyDeviceStats(): DeviceStats {
  return { total: 0, online: 0, offline: 0, unstable: 0, unknown: 0 };
}

// ---------------------------------------------------------------------------
// Devices helpers
// ---------------------------------------------------------------------------

/**
 * Regras:
 *  - Considera apenas devices com isManaged !== false.
 *  - Se existir console e houver outros devices, NÃO conta o console.
 *  - Qualquer status diferente de "online" conta como offline.
 */
export function computeDeviceStatsFromHost(
  deviceHost: any | null | undefined
): DeviceStats {
  if (!deviceHost || !Array.isArray(deviceHost.devices)) {
    return emptyDeviceStats();
  }

  const managed = deviceHost.devices.filter(
    (d: any) => d && d.isManaged !== false
  );

  if (managed.length === 0) {
    return emptyDeviceStats();
  }

  const consoleDev = managed.find((d: any) => d?.isConsole === true);
  const realDevices =
    consoleDev && managed.length > 1
      ? managed.filter((d: any) => !d?.isConsole)
      : managed;

  const stats: DeviceStats = {
    total: realDevices.length,
    online: 0,
    offline: 0,
    unstable: 0,
    unknown: 0,
  };

  for (const dev of realDevices) {
    const st = String(dev.status ?? "").toLowerCase();
    if (st === "online") {
      stats.online += 1;
    } else {
      // qualquer coisa diferente de "online" entra como offline
      stats.offline += 1;
    }
  }

  return stats;
}

/**
 * Status agregado de devices:
 *  - totalDevices === 0 → "online" (não derruba site só porque não tem device gerenciável).
 *  - offlineDevices === 0 → "online".
 *  - razão offline / total:
 *      >= 0.5  → "offline"
 *      >= 0.1  → "unstable"
 *      <  0.1  → "online"
 */
export function computeDevicesStatus(
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

/**
 * Descobre o status do "controller" (UDM/console) a partir dos devices.
 *
 * Regras:
 *  - Se não existir console → null.
 *  - status === "online" → true.
 *  - Qualquer outro status string → false.
 */
export function controllerOnlineFromDeviceHost(
  deviceHost: any | null | undefined
): boolean | null {
  if (!deviceHost || !Array.isArray(deviceHost.devices)) return null;

  const consoleDev = deviceHost.devices.find((d: any) => d?.isConsole);
  if (!consoleDev) return null;

  const st = String(consoleDev.status ?? "").toLowerCase();
  if (st === "online") return true;
  if (st) return false;
  return null;
}

// ---------------------------------------------------------------------------
// WAN helpers
// ---------------------------------------------------------------------------

/**
 * Converte dados brutos de WAN da UniFi Cloud em OverallStatus.
 *
 * Regras:
 *  - wanUptime === 0             → "offline"
 *  - wanUptime < 80              → "offline"
 *  - issues com downtime/latency → "unstable" (se uptime !== 0)
 *  - wanUptime > 95 sem issues   → "online"
 *  - Sem info consistente        → "unknown"
 */
export function mapWanStatus(
  wan: any | null | undefined
): OverallStatus | null {
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

  if (uptimeRaw === null || uptimeRaw === undefined) {
    if (hasDowntime) return "offline";
    if (hasHighLatency) return "unstable";
    return "unknown";
  }

  const uptime = Number(uptimeRaw);
  if (!Number.isFinite(uptime)) return "unknown";

  if (uptime === 0) return "offline";
  if (uptime < 80) return "offline";

  if ((hasDowntime || hasHighLatency) && uptime !== 0) {
    return "unstable";
  }

  if (uptime > 95 && !hasDowntime && !hasHighLatency) {
    return "online";
  }

  return "unknown";
}

// ---------------------------------------------------------------------------
// Hints de statistics.counts (sites zumbis / reconciliar devices)
// ---------------------------------------------------------------------------

/**
 * Hint forte de que "tudo está offline", baseado em statistics.counts.
 *
 * Regras (como você descreveu):
 *  - se offlineDevice >= totalDevice         → strongOfflineHint = true
 *  - se offlineGatewayDevice >= gatewayDevice → strongOfflineHint = true
 */
export function computeStrongOfflineHint(rawSite: any): StrongOfflineHint {
  const counts = rawSite?.statistics?.counts ?? {};

  const total =
    typeof counts.totalDevice === "number" ? counts.totalDevice : null;
  const offline =
    typeof counts.offlineDevice === "number" ? counts.offlineDevice : null;
  const gateway =
    typeof counts.gatewayDevice === "number" ? counts.gatewayDevice : null;
  const offlineG =
    typeof counts.offlineGatewayDevice === "number"
      ? counts.offlineGatewayDevice
      : null;

  let strongOfflineHint = false;

  if (
    total !== null &&
    total > 0 &&
    offline !== null &&
    offline >= total
  ) {
    strongOfflineHint = true;
  }

  if (
    gateway !== null &&
    gateway > 0 &&
    offlineG !== null &&
    offlineG >= gateway
  ) {
    strongOfflineHint = true;
  }

  return {
    strongOfflineHint,
    totalDevice: total,
    offlineDevice: offline,
    gatewayDevice: gateway,
    offlineGatewayDevice: offlineG,
  };
}

// ---------------------------------------------------------------------------
// Zumbi / Stale host
// ---------------------------------------------------------------------------

/**
 * Considera o host "stale" (zumbi) se o updatedAt dele ficou velho demais.
 *
 * Aqui usamos um limiar BEM MAIS LONGO que 2h para não derrubar tudo.
 * Ex: 7 dias.
 *
 * Importante:
 *  - Se não houver updatedAt, NÃO marcamos como stale.
 */
export function isHostStale(
  deviceHost: any | null | undefined,
  maxAgeMinutes = 60 * 24 * 7 // 7 dias
): boolean {
  if (!deviceHost?.updatedAt) return false;

  const lastUpdate = new Date(deviceHost.updatedAt).getTime();
  if (!Number.isFinite(lastUpdate)) return false;

  const now = Date.now();
  const diffMinutes = (now - lastUpdate) / 1000 / 60;

  return diffMinutes > maxAgeMinutes;
}

// ---------------------------------------------------------------------------
// OverallStatus agregando tudo
// ---------------------------------------------------------------------------

function consolidateWans(
  wan1Status: OverallStatus | null,
  wan2Status: OverallStatus | null
): OverallStatus {
  const vals = [wan1Status, wan2Status].filter(
    (v): v is OverallStatus =>
      v === "online" || v === "offline" || v === "unstable" || v === "unknown"
  );

  if (vals.length === 0) return "unknown";
  if (vals.includes("offline")) return "offline";
  if (vals.includes("unstable")) return "unstable";
  if (vals.includes("online")) return "online";
  return "unknown";
}

/**
 * Regras de overallStatus (seu resumo):
 *
 * unknown:
 *   - sem dados de WAN (ambas unknown/null);
 *   - totalDevices === 0;
 *   - controllerOnline === null.
 *
 * offline:
 *   - strongOfflineHint && controllerOnline === false;
 *   - OU todos os devices reais offline E (controllerOnline === false OU WAN consolidado "offline");
 *   - OU totalDevices === 0 E (controllerOnline === false OU WAN consolidado "offline").
 *
 * unstable:
 *   - controller offline, mas ainda existem devices reais online;
 *   - OU devices aggregated "unstable";
 *   - OU WAN consolidada "unstable".
 *
 * online:
 *   - todo resto em que o agregado de devices é "online".
 */
export function computeOverallStatus(input: {
  deviceStats: DeviceStats;
  wan1Status: OverallStatus | null;
  wan2Status: OverallStatus | null;
  controllerOnline: boolean | null;
  strongOfflineHint: boolean;
}): OverallStatus {
  const { deviceStats, wan1Status, wan2Status, controllerOnline, strongOfflineHint } =
    input;

  const totalDevices = deviceStats.total;
  const offlineDevices = deviceStats.offline;

  const devicesAgg = computeDevicesStatus(totalDevices, offlineDevices);
  const wanCombined = consolidateWans(wan1Status, wan2Status);
  const wanIsKnown =
    wanCombined === "online" ||
    wanCombined === "offline" ||
    wanCombined === "unstable";

  // 1) unknown puro
  if (totalDevices === 0 && controllerOnline === null && !wanIsKnown) {
    return "unknown";
  }

  // 2) Hint forte de tudo morto + controller offline → offline direto
  if (strongOfflineHint && controllerOnline === false) {
    return "offline";
  }

  // 3) Offline por devices + controller/WAN
  if (
    totalDevices > 0 &&
    offlineDevices >= totalDevices &&
    (controllerOnline === false || wanCombined === "offline")
  ) {
    return "offline";
  }

  if (
    totalDevices === 0 &&
    (controllerOnline === false || wanCombined === "offline")
  ) {
    return "offline";
  }

  // 4) Unstable:
  //    - controller offline mas ainda existem devices online
  //    - ou agregado de devices "unstable"
  //    - ou WAN consolidada "unstable"
  if (
    controllerOnline === false &&
    totalDevices > 0 &&
    offlineDevices < totalDevices
  ) {
    return "unstable";
  }

  if (devicesAgg === "unstable") {
    return "unstable";
  }

  if (wanCombined === "unstable") {
    return "unstable";
  }

  // 5) Se devicesAgg é "online" e não temos evidência forte do contrário → online
  if (devicesAgg === "online") {
    return "online";
  }

  // Last resort: unknown
  return "unknown";
}

// ---------------------------------------------------------------------------
// Função principal: converte rawSite + deviceHost -> SiteStatusSummary
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
    deviceHost?._id ??
    null;

  // Nome do site
  const descRaw =
    typeof rawSite?.meta?.desc === "string"
      ? rawSite.meta.desc.trim()
      : "";

  const cleanDesc =
    descRaw && descRaw.toLowerCase() !== "default" ? descRaw : "";

  let siteName: string =
    cleanDesc ||
    (deviceHost?.hostName && String(deviceHost.hostName).trim()) ||
    (deviceHost?.name && String(deviceHost.name).trim()) ||
    (rawSite?.meta?.name && String(rawSite.meta.name).trim()) ||
    (rawSite?.siteName && String(rawSite.siteName).trim()) ||
    "Unknown";

  if (siteName.trim().toLowerCase() === "default") {
    siteName = "Unknown";
  }

  // Controller + devices
  let controllerOnline = controllerOnlineFromDeviceHost(deviceHost);
  let deviceStats = computeDeviceStatsFromHost(deviceHost);

  // Hints de counts
  const countsHint = computeStrongOfflineHint(rawSite);

  // WANs
  const wans = rawSite?.statistics?.wans;
  let wan1Status = mapWanStatus(wans?.WAN);
  let wan2Status = mapWanStatus(wans?.WAN2);

  // Stale / zumbi
  const stale = isHostStale(deviceHost);

  // Flag para debug
  let forcedOnlineByCounts = false;

  // -----------------------------------------------------------------------
  // 1) SITE ZUMBI (host stale): host desatualizado há muitos dias.
  //
  // Nestes casos, mesmo que counts diga offlineDevice = 0, você quer
  // tratar o site como "morto" / legado. Então:
  //   - controller vira offline;
  //   - WAN online vira offline;
  //   - devices todos offline.
  // -----------------------------------------------------------------------
  if (stale) {
    controllerOnline = false;

    if (wan1Status === "online") wan1Status = "offline";
    if (wan2Status === "online") wan2Status = "offline";

    const totalRef =
      (countsHint.totalDevice !== null && countsHint.totalDevice > 0
        ? countsHint.totalDevice
        : deviceStats.total) || 0;

    deviceStats = {
      total: totalRef,
      online: 0,
      offline: totalRef,
      unstable: 0,
      unknown: 0,
    };
  }

  // -----------------------------------------------------------------------
  // 2) FALSO OFFLINE (API bug): devices todos offline, mas counts dizendo
  //    que ninguém está offline (CTMIG, OKAY, etc.).
  //
  // Situação:
  //   - NÃO estamos em host stale;
  //   - counts.totalDevice > 0;
  //   - counts.offlineDevice === 0;
  //   - deviceStats.total > 0;
  //   - deviceStats.offline === deviceStats.total.
  //
  // Nestes casos, confiamos em counts e consideramos todos devices ONLINE.
  // -----------------------------------------------------------------------
  const totalDevice = countsHint.totalDevice;
  const offlineDevice = countsHint.offlineDevice;

  if (
    !stale &&
    totalDevice !== null &&
    totalDevice > 0 &&
    offlineDevice === 0 &&
    deviceStats.total > 0 &&
    deviceStats.offline === deviceStats.total
  ) {
    forcedOnlineByCounts = true;

    deviceStats = {
      ...deviceStats,
      online: deviceStats.total,
      offline: 0,
    };

    // Se gateway está 100% OK, faz sentido assumir controller online também.
    if (
      countsHint.gatewayDevice !== null &&
      countsHint.gatewayDevice > 0 &&
      (countsHint.offlineGatewayDevice === null ||
        countsHint.offlineGatewayDevice === 0)
    ) {
      controllerOnline = true;
    }
  }

  // -----------------------------------------------------------------------
  // 3) counts dizem "tudo morto" + controller offline → WAN não pode estar online
  //    (regra original de zumbi por counts).
  // -----------------------------------------------------------------------
  if (countsHint.strongOfflineHint && controllerOnline === false) {
    if (wan1Status === "online") wan1Status = "offline";
    if (wan2Status === "online") wan2Status = "offline";
  }

  // strongOfflineHint final leva em conta counts E stale
  const strongOfflineFlag = countsHint.strongOfflineHint || stale;

  const overallStatus = computeOverallStatus({
    deviceStats,
    wan1Status,
    wan2Status,
    controllerOnline,
    strongOfflineHint: strongOfflineFlag,
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
      devicesStatus: computeDevicesStatus(deviceStats.total, deviceStats.offline),
      isStale: stale,
      forcedOnlineByCounts,
    },
  };
}