// src/lib/unifiSiteManager.ts
import { getEnvOrThrow } from '@/lib/env';

const UNIFI_API_BASE_URL = getEnvOrThrow('UNIFI_API_BASE_URL');
const UNIFI_API_TOKEN = getEnvOrThrow('UNIFI_API_TOKEN');

const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-API-Key': UNIFI_API_TOKEN, // UniFi Site Manager usa API Key nesse header
};

export async function unifiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${UNIFI_API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...DEFAULT_HEADERS,
      ...(init.headers ?? {}),
    },
    // Importantíssimo pra não cachear nada de status:
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[unifiFetch] Erro ${res.status} ao chamar ${url}`, text);
    throw new Error(`Erro ao chamar UniFi API: ${res.status}`);
  }

  return (await res.json()) as T;
}

/**
 * Resumo de um site retornado pelo Site Manager.
 * Ajusta os campos conforme o JSON real da sua conta.
 */
export interface UnifiRawSite {
  id: string; // às vezes é "id", às vezes é "_id" – ajusta se precisar
  name: string;
  // hostName, controllerName etc podem ser adicionados aqui depois
  [key: string]: any;
}

/**
 * WAN + controller health de um site.
 * Esse shape é flexível: a gente tenta normalizar o máximo possível.
 */
export interface UnifiRawWanStatus {
  wan1?: any;
  wan2?: any;
  controller?: any;
  [key: string]: any;
}

/**
 * Lista de sites cadastrados no Site Manager.
 * Endpoint base – AJUSTA o path se na sua conta for diferente.
 */
export async function listUnifiSites(): Promise<UnifiRawSite[]> {
  // Exemplo de path: "/v1/sites" – se na sua conta for "/site-manager/v1/sites", é só trocar aqui.
  const data = await unifiFetch<{ data?: UnifiRawSite[]; sites?: UnifiRawSite[] }>('/v1/sites');

  // Normaliza pra sempre devolver um array
  return data.data ?? data.sites ?? [];
}

/**
 * Busca o status de WAN / controller de um site específico.
 * Endpoint – AJUSTA o path e o formato conforme o JSON real.
 */
export async function getUnifiSiteWanStatus(
  siteId: string,
): Promise<UnifiRawWanStatus | null> {
  if (!siteId) return null;

  // Exemplo de path: "/v1/sites/{id}/wan" – ajusta pro que você usa hoje.
  const path = `/v1/sites/${siteId}/wan`;

  try {
    const data = await unifiFetch<UnifiRawWanStatus>(path);
    return data;
  } catch (error) {
    console.error(`[UniFi] Erro ao buscar WAN para site ${siteId}:`, error);
    return null;
  }
}