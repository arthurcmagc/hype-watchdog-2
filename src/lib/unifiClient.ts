// src/lib/unifiClient.ts

// Helper pra garantir env em tempo de compilação + runtime
function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }
  return value;
}

// Agora essas constantes são sempre string, não "string | undefined"
const UNIFI_API_BASE_URL = getEnvOrThrow('UNIFI_API_BASE_URL');
const UNIFI_API_TOKEN = getEnvOrThrow('UNIFI_API_TOKEN');

export async function unifiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = new URL(path, UNIFI_API_BASE_URL).toString();

  const res = await fetch(url, {
    ...init,
    headers: {
      'X-API-Key': UNIFI_API_TOKEN, // ✅ agora é string
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('Erro UniFi API', res.status, text);
    throw new Error(
      `Erro na UniFi API (${res.status}) ao acessar ${url}: ${
        text || res.statusText
      }`
    );
  }

  return res.json() as Promise<T>;
}

/* ============================
 * Tipagens e funções de alto nível
 * ============================ */

export interface UnifiDevice {
  id?: string;
  mac?: string;
  model?: string;
  name?: string;
  ipAddress?: string;
  status?: string;
}

export interface UnifiHostWithDevices {
  hostId: string;
  hostName: string;
  devices: UnifiDevice[];
}

export interface UnifiDevicesResponse {
  data: UnifiHostWithDevices[];
}

/**
 * Lista dispositivos detalhados, agrupados por host (site/organização).
 * Endpoint UniFi Site Manager: /v1/devices
 */
export async function listUnifiDevices() {
  return unifiFetch<UnifiDevicesResponse>('/v1/devices');
}