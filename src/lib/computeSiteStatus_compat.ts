export type OverallStatus = "online" | "unstable" | "offline" | "unknown";

export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  unstable: number;
  unknown: number;
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

export interface ComputeSiteInput {
  siteName: string;
  controllerOnline: boolean | null;
  wan1: string | null;
  wan2: string | null;
  deviceStats: DeviceStats;
}

export interface SiteStatusSummary {
  siteId: string | null;
  hostId: string | null;
  siteName: string;
  controllerOnline: boolean | null;
  wan1: string | null;
  wan2: string | null;
  overallStatus: OverallStatus;
  deviceStats: DeviceStats;
}

/**
 * Regra simples baseada nos devices.
 * Se quiser igual ao Site Manager, refinarei depois.
 */
function computeOverallStatus(deviceStats: DeviceStats): OverallStatus {
  if (deviceStats.offline > 0) return "offline";
  if (deviceStats.unstable > 0) return "unstable";
  if (deviceStats.online > 0) return "online";
  return "unknown";
}

/**
 * VERSÃO COMPATÍVEL com o seu route.ts atual.
 */
export function computeSiteStatus(input: ComputeSiteInput): SiteStatusSummary {
  const { siteName, controllerOnline, wan1, wan2, deviceStats } = input;

  const overallStatus = computeOverallStatus(deviceStats);

  return {
    siteId: null,
    hostId: null,
    siteName,
    controllerOnline,
    wan1,
    wan2,
    overallStatus,
    deviceStats,
  };
}