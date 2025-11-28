// src/app/api/unifi-cloud/sites/siteStatus.ts

// Estado genérico de um device / site
export type HealthState = "online" | "offline" | "warning" | "unknown";

/**
 * Representa um device resumido dentro de um site.
 * Campos opcionais + index signature para não brigar com o que já existe.
 */
export interface DeviceStats {
  id: string;
  name?: string;
  model?: string;
  ip?: string;
  state?: HealthState | string;
  lastSeen?: string;
  // Permite campos extras sem quebrar o tipo
  [key: string]: unknown;
}

/**
 * Status agregado de um site.
 */
export interface SiteStatus {
  siteId: string;
  siteName: string;

  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  warningDevices: number;

  health: HealthState;

  devices?: DeviceStats[];

  // Campos extras que você quiser anexar
  [key: string]: unknown;
}